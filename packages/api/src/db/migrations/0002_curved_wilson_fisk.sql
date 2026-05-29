CREATE TABLE `processed_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`message_id` text NOT NULL,
	`processed_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processed_messages_subscriber_message_idx` ON `processed_messages` (`subscriber_id`,`message_id`);