CREATE TABLE `correction_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`field` text NOT NULL,
	`message` text NOT NULL,
	`contact_email` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `correction_requests_status_idx` ON `correction_requests` (`status`);--> statement-breakpoint
CREATE TABLE `sponsorships` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`outlet_id` text,
	`outlet_name` text NOT NULL,
	`outlet_url` text NOT NULL,
	`country_iso` text NOT NULL,
	`category` text NOT NULL,
	`slot_position` integer NOT NULL,
	`status` text NOT NULL,
	`reserved_until` text,
	`starts_at` text,
	`ends_at` text,
	`ls_subscription_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsorships_live_slot_uq` ON `sponsorships` (`country_iso`,`category`,`slot_position`) WHERE status IN ('reserved', 'active', 'grace');--> statement-breakpoint
CREATE INDEX `sponsorships_status_idx` ON `sponsorships` (`status`);--> statement-breakpoint
CREATE INDEX `sponsorships_subscription_idx` ON `sponsorships` (`ls_subscription_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_name` text NOT NULL,
	`url` text NOT NULL,
	`country_iso` text NOT NULL,
	`category` text NOT NULL,
	`contact_email` text,
	`note` text,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`ls_order_id` text,
	`ls_subscription_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `submissions_status_idx` ON `submissions` (`status`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`idempotency_key` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
