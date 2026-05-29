CREATE TABLE `days` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`seed_state` text NOT NULL,
	`ignored_report` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`event_seq` integer NOT NULL,
	`agent` text NOT NULL,
	`context_snapshot` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model_id` text NOT NULL,
	`raw_output` text NOT NULL,
	`parsed` text NOT NULL,
	`reasoning` text NOT NULL,
	`source` text NOT NULL,
	`valid` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decisions_run_event_agent_idx` ON `decisions` (`run_id`,`event_seq`,`agent`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`day_id` text NOT NULL,
	`seq` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_day_seq_idx` ON `events` (`day_id`,`seq`);--> statement-breakpoint
CREATE TABLE `impacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`waste_pct` real NOT NULL,
	`waste_value` real NOT NULL,
	`stockout_events` integer NOT NULL,
	`missed_revenue` real NOT NULL,
	`ending_margin_pct` real NOT NULL,
	`ending_inventory_value` real NOT NULL,
	`metrics` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `impacts_run_id_unique` ON `impacts` (`run_id`);--> statement-breakpoint
CREATE TABLE `run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`state_snapshot` text NOT NULL,
	`order_state` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_steps_run_seq_idx` ON `run_steps` (`run_id`,`seq`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`day_id` text NOT NULL,
	`version_id` text NOT NULL,
	`parent_run_id` text,
	`fork_event_seq` integer,
	`fork_change` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`label` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`inventory_prompt_version` text NOT NULL,
	`pricing_prompt_version` text NOT NULL,
	`model_id` text NOT NULL,
	`policy` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_label_unique` ON `versions` (`label`);