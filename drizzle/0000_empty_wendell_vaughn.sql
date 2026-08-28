CREATE TABLE `website_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`page` text NOT NULL,
	`referrer_host` text NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL,
	`utm_medium` text DEFAULT '' NOT NULL,
	`utm_campaign` text DEFAULT '' NOT NULL,
	`device` text NOT NULL,
	`browser` text NOT NULL,
	`language` text NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`consent` text DEFAULT 'analytics' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_visits_session_id_unique` ON `website_visits` (`session_id`);