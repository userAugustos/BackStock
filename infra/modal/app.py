"""
Serve Qwen3-8B via vLLM on Modal as an OpenAI-compatible endpoint for BackStock.

BackStock's LLM client calls `POST {MODAL_LLM_URL}/v1/chat/completions` using the
OpenAI chat schema and proxy-auth headers (Modal-Key / Modal-Secret). vLLM already
speaks that schema; this app just runs it on a GPU and exposes it behind a
proxy-auth-protected Modal web endpoint.

Deploy:
    modal deploy infra/modal/app.py

The deploy prints a URL like:
    https://<workspace>--backstock-qwen-serve.modal.run
Put that (WITHOUT the /v1 suffix) into BackStock's MODAL_LLM_URL.

Notes on version-sensitive bits (tweak if `modal deploy` errors on your versions):
  - `@modal.concurrent(max_inputs=...)` is the current API; older Modal used
    `allow_concurrent_inputs=...` as a kwarg on `@app.function`.
  - `requires_proxy_auth=True` enforces the Modal-Key/Modal-Secret headers.
  - `--default-chat-template-kwargs` (vLLM >= 0.9) disables Qwen3 "thinking".
"""

import modal

# This string is BOTH what vLLM serves AND the `model_id` a BackStock Version must use.
MODEL_NAME = "Qwen/Qwen3-8B"  # public, Apache-2.0 — no HF token needed
VLLM_PORT = 8000
MINUTES = 60

# CUDA base + vLLM (its OpenAI server is bundled). hf_transfer speeds the weight pull.
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.21.0", "huggingface_hub[hf_transfer]")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# Cache weights + vLLM compile artifacts across cold starts. First request downloads
# ~16GB into the volume; afterwards boots are fast.
hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)

app = modal.App("backstock-qwen")


@app.function(
    image=vllm_image,
    gpu="A100-40GB",  # plenty for an 8B model; "A10G"/"L4" (24GB) also work if you lower --max-model-len
    volumes={
        "/root/.cache/huggingface": hf_cache,
        "/root/.cache/vllm": vllm_cache,
    },
    scaledown_window=15 * MINUTES,  # keep the model warm 15 min after the last request
)
@modal.concurrent(max_inputs=32)  # one warm container serves many requests (vLLM batches internally)
@modal.web_server(
    port=VLLM_PORT,
    startup_timeout=20 * MINUTES,  # first boot downloads + loads the weights
    requires_proxy_auth=True,  # 401s unless the caller sends valid Modal-Key / Modal-Secret
)
def serve():
    import subprocess

    cmd = [
        "vllm",
        "serve",
        MODEL_NAME,
        "--served-model-name",
        MODEL_NAME,  # the name clients send as `model` (== a Version's model_id)
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--max-model-len",
        "16384",
        "--gpu-memory-utilization",
        "0.90",
        # Qwen3 emits <think>…</think> by default; that would burn the 512-token budget and
        # break JSON parsing. Disable it so the agent gets the JSON object directly.
        "--default-chat-template-kwargs",
        '{"enable_thinking": false}',
    ]
    subprocess.Popen(cmd)  # non-blocking; Modal keeps the container alive and proxies the port
