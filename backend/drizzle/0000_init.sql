CREATE TABLE `addresses` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`label` varchar(50) NOT NULL DEFAULT '',
	`receiver_name` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`province` varchar(100) NOT NULL,
	`district` varchar(100) NOT NULL,
	`ward` varchar(100) NOT NULL,
	`street` varchar(255) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`default_owner` char(36) GENERATED ALWAYS AS (if(`is_default`, `user_id`, null)) VIRTUAL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `addresses_one_default_uq` UNIQUE(`default_owner`)
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`user_id` char(36) NOT NULL,
	`bank_name` varchar(100) NOT NULL,
	`account_holder` varchar(100) NOT NULL,
	`account_number_enc` varchar(512) NOT NULL,
	`account_last4` char(4) NOT NULL,
	`key_version` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `bank_accounts_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_resets_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`family_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`replaced_by` char(36),
	`remember` boolean NOT NULL DEFAULT false,
	`user_agent` varchar(255) NOT NULL DEFAULT '',
	`ip` varchar(45) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_used_at` datetime(3),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL DEFAULT '',
	`avatar_url` varchar(512),
	`role` enum('customer','admin') NOT NULL DEFAULT 'customer',
	`status` enum('active','locked') NOT NULL DEFAULT 'active',
	`locked_reason` varchar(255),
	`birthday` date,
	`gender` enum('male','female','other'),
	`member_level` tinyint NOT NULL DEFAULT 1,
	`level_source` enum('purchases','deposit','admin'),
	`level_up_at` datetime(3),
	`deposit_balance` bigint NOT NULL DEFAULT 0,
	`tags` json NOT NULL,
	`admin_note` text,
	`failed_logins` int NOT NULL DEFAULT 0,
	`login_locked_until` datetime(3),
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`),
	CONSTRAINT `users_member_level_chk` CHECK(`users`.`member_level` in (1, 2)),
	CONSTRAINT `users_deposit_chk` CHECK(`users`.`deposit_balance` >= 0)
);
--> statement-breakpoint
CREATE TABLE `counters` (
	`name` varchar(40) NOT NULL,
	`value` bigint NOT NULL DEFAULT 0,
	CONSTRAINT `counters_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` char(36) NOT NULL,
	`number` int NOT NULL,
	`title` varchar(150) NOT NULL,
	`caption` text NOT NULL,
	`images` json NOT NULL,
	`published_at` datetime(3) NOT NULL,
	`opens_at` datetime(3) NOT NULL,
	`lot_cost` bigint,
	`supplier` varchar(150),
	`created_by` char(36),
	`retired_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `feeds_id` PRIMARY KEY(`id`),
	CONSTRAINT `feeds_number_uq` UNIQUE(`number`),
	CONSTRAINT `feeds_lot_cost_chk` CHECK(`feeds`.`lot_cost` is null or `feeds`.`lot_cost` >= 0)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(80) NOT NULL,
	`price` bigint NOT NULL,
	`attribute` varchar(40) NOT NULL,
	`attribute_key` enum('pyrus','aquos','subterra','haos','darkus','ventus'),
	`series` enum('battle-brawlers','new-vestroia','gundalian-invaders','mechtanium-surge','battle-planet','geogan-rising'),
	`condition_text` varchar(160),
	`photos` json NOT NULL,
	`video` varchar(512),
	`status` enum('available','sold') NOT NULL DEFAULT 'available',
	`sold_at` datetime(3),
	`sold_via` enum('order','manual'),
	`order_id` char(36),
	`sold_note` varchar(255),
	`buyer_name` varchar(100),
	`feed_id` char(36),
	`position` int NOT NULL DEFAULT 0,
	`feed_title_snapshot` varchar(150),
	`feed_number_snapshot` int,
	`search_text` varchar(600) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `items_id` PRIMARY KEY(`id`),
	CONSTRAINT `items_code_uq` UNIQUE(`code`),
	CONSTRAINT `items_price_chk` CHECK(`items`.`price` > 0),
	CONSTRAINT `items_sold_at_chk` CHECK(`items`.`status` <> 'sold' or `items`.`sold_at` is not null)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` char(36) NOT NULL,
	`path` varchar(255) NOT NULL,
	`url` varchar(512) NOT NULL,
	`kind` enum('image','video') NOT NULL,
	`mime` varchar(64) NOT NULL,
	`bytes` bigint NOT NULL,
	`width` int,
	`height` int,
	`sha256` char(64) NOT NULL,
	`uploaded_by` char(36),
	`in_use` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_path_uq` UNIQUE(`path`),
	CONSTRAINT `media_url_uq` UNIQUE(`url`)
);
--> statement-breakpoint
CREATE TABLE `card_payments` (
	`order_id` char(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`brand` enum('visa','mastercard','jcb','amex'),
	`last4` char(4),
	`transaction_id` varchar(100),
	`paid_at` datetime(3),
	`last_error` varchar(255),
	`refunded_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `card_payments_order_id` PRIMARY KEY(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`idem_key` varchar(100) NOT NULL,
	`route` varchar(100) NOT NULL,
	`request_hash` char(64) NOT NULL,
	`response_status` int,
	`response` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `idempotency_keys_user_key_uq` UNIQUE(`user_id`,`idem_key`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`status` enum('pending','confirmed','packing','shipping','completed','cancelled','returned') NOT NULL,
	`at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`actor_type` enum('customer','admin','system','gateway') NOT NULL,
	`actor_id` char(36),
	`actor_name` varchar(100) NOT NULL,
	`note` varchar(1000),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_issues` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`type` enum('late-delivery','damaged','wrong-item','lost','payment','unreachable','other') NOT NULL,
	`status` enum('open','investigating','resolved') NOT NULL DEFAULT 'open',
	`description` text NOT NULL,
	`reported_by` enum('admin','customer','carrier','system') NOT NULL,
	`payment_attempt_id` char(36),
	`resolution` text,
	`created_by` char(36),
	`resolved_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `order_issues_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_issues_payment_attempt_uq` UNIQUE(`payment_attempt_id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`item_id` char(36),
	`auction_id` char(36),
	`code` varchar(20),
	`name` varchar(150) NOT NULL,
	`price` bigint NOT NULL,
	`image` varchar(512) NOT NULL DEFAULT '',
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_items_price_chk` CHECK(`order_items`.`price` >= 0)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`user_id` char(36),
	`customer_email` varchar(254),
	`source` enum('web','auction','manual') NOT NULL,
	`status` enum('pending','confirmed','packing','shipping','completed','cancelled','returned') NOT NULL DEFAULT 'pending',
	`payment_method` enum('cod','bank-transfer','momo','card') NOT NULL,
	`payment_status` enum('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
	`subtotal` bigint NOT NULL,
	`shipping_fee` bigint NOT NULL,
	`discount` bigint NOT NULL DEFAULT 0,
	`total` bigint NOT NULL,
	`coupon_code` varchar(40),
	`receiver_name` varchar(100) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`address_line` varchar(500) NOT NULL,
	`shipping_region` enum('domestic','international') NOT NULL DEFAULT 'domestic',
	`intl_address` json,
	`note` varchar(500),
	`internal_note` text,
	`cancel_reason` enum('customer-request','out-of-stock','payment-timeout','unreachable','duplicate','fraud-suspected','other'),
	`cancel_note` varchar(500),
	`auction_id` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_code_uq` UNIQUE(`code`),
	CONSTRAINT `orders_amounts_chk` CHECK(`orders`.`subtotal` >= 0 and `orders`.`shipping_fee` >= 0 and `orders`.`discount` >= 0),
	CONSTRAINT `orders_total_chk` CHECK(`orders`.`total` = greatest(0, `orders`.`subtotal` + `orders`.`shipping_fee` - `orders`.`discount`))
);
--> statement-breakpoint
CREATE TABLE `payment_attempts` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`gateway` varchar(20) NOT NULL,
	`amount` bigint NOT NULL,
	`status` enum('open','succeeded','failed','closed') NOT NULL DEFAULT 'open',
	`gateway_txn_id` varchar(100),
	`brand` enum('visa','mastercard','jcb','amex'),
	`last4` char(4),
	`response_code` varchar(20),
	`message` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attempts_gateway_txn_uq` UNIQUE(`gateway`,`gateway_txn_id`),
	CONSTRAINT `payment_attempts_amount_chk` CHECK(`payment_attempts`.`amount` > 0)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` char(36) NOT NULL,
	`gateway` varchar(20) NOT NULL,
	`event_key` varchar(191) NOT NULL,
	`attempt_id` char(36),
	`payload` json NOT NULL,
	`signature_ok` boolean NOT NULL,
	`result` varchar(40) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_events_event_key_uq` UNIQUE(`event_key`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`attempt_id` char(36) NOT NULL,
	`amount` bigint NOT NULL,
	`status` enum('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
	`gateway_refund_id` varchar(100),
	`requested_by` char(36) NOT NULL,
	`error` varchar(255),
	`active_attempt` char(36) GENERATED ALWAYS AS (if(`status` in ('pending', 'succeeded'), `attempt_id`, null)) VIRTUAL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `refunds_one_active_uq` UNIQUE(`active_attempt`),
	CONSTRAINT `refunds_amount_chk` CHECK(`refunds`.`amount` > 0)
);
--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` char(36) NOT NULL,
	`coupon_code` varchar(40) NOT NULL,
	`order_id` char(36) NOT NULL,
	`user_id` char(36),
	`released_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `coupon_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupon_redemptions_order_uq` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`code` varchar(40) NOT NULL,
	`label` varchar(150) NOT NULL,
	`type` enum('percent','amount','shipping') NOT NULL,
	`value` bigint NOT NULL,
	`min_subtotal` bigint NOT NULL DEFAULT 0,
	`max_discount` bigint,
	`starts_at` datetime(3),
	`expires_at` datetime(3),
	`active` boolean NOT NULL DEFAULT true,
	`first_order_only` boolean NOT NULL DEFAULT false,
	`per_user_limit` int,
	`total_limit` int,
	`used_count` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `coupons_code` PRIMARY KEY(`code`),
	CONSTRAINT `coupons_value_chk` CHECK(`coupons`.`value` >= 0 and `coupons`.`min_subtotal` >= 0),
	CONSTRAINT `coupons_percent_chk` CHECK(`coupons`.`type` <> 'percent' or `coupons`.`value` between 1 and 100),
	CONSTRAINT `coupons_used_chk` CHECK(`coupons`.`used_count` >= 0)
);
--> statement-breakpoint
CREATE TABLE `membership_requests` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`kind` enum('deposit','review') NOT NULL,
	`amount` bigint,
	`transfer_note` varchar(100),
	`message` varchar(1000),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`resolved_at` datetime(3),
	`resolved_by` char(36),
	`admin_note` varchar(500),
	`pending_owner` char(36) GENERATED ALWAYS AS (if(`status` = 'pending', `user_id`, null)) VIRTUAL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `membership_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_requests_one_pending_uq` UNIQUE(`pending_owner`),
	CONSTRAINT `membership_requests_amount_chk` CHECK(`membership_requests`.`amount` is null or `membership_requests`.`amount` > 0)
);
--> statement-breakpoint
CREATE TABLE `auction_fulfillments` (
	`auction_id` char(36) NOT NULL,
	`status` enum('order-created','forfeited') NOT NULL,
	`order_id` char(36),
	`note` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `auction_fulfillments_auction_id` PRIMARY KEY(`auction_id`)
);
--> statement-breakpoint
CREATE TABLE `auctions` (
	`id` char(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(150) NOT NULL,
	`description` text NOT NULL,
	`images` json NOT NULL,
	`attribute` varchar(40) NOT NULL,
	`attribute_key` enum('pyrus','aquos','subterra','haos','darkus','ventus'),
	`series` enum('battle-brawlers','new-vestroia','gundalian-invaders','mechtanium-surge','battle-planet','geogan-rising') NOT NULL,
	`condition_text` varchar(160),
	`accessories` json NOT NULL,
	`start_price` bigint NOT NULL,
	`current_price` bigint NOT NULL,
	`bid_step` bigint NOT NULL,
	`buy_now_price` bigint,
	`start_at` datetime(3) NOT NULL,
	`end_at` datetime(3) NOT NULL,
	`original_end_at` datetime(3) NOT NULL,
	`price_visibility` enum('open','sealed') NOT NULL DEFAULT 'open',
	`anti_snipe_minutes` int NOT NULL DEFAULT 0,
	`extension_count` int NOT NULL DEFAULT 0,
	`bid_count` int NOT NULL DEFAULT 0,
	`leader_id` char(36),
	`watcher_count` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `auctions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auctions_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `auctions_prices_chk` CHECK(`auctions`.`start_price` > 0 and `auctions`.`bid_step` > 0),
	CONSTRAINT `auctions_current_chk` CHECK(`auctions`.`current_price` >= `auctions`.`start_price`),
	CONSTRAINT `auctions_time_chk` CHECK(`auctions`.`end_at` > `auctions`.`start_at`),
	CONSTRAINT `auctions_anti_snipe_chk` CHECK(`auctions`.`anti_snipe_minutes` between 0 and 60)
);
--> statement-breakpoint
CREATE TABLE `bids` (
	`id` char(36) NOT NULL,
	`auction_id` char(36) NOT NULL,
	`bidder_id` char(36) NOT NULL,
	`amount` bigint NOT NULL,
	`triggered_extension` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `bids_id` PRIMARY KEY(`id`),
	CONSTRAINT `bids_amount_chk` CHECK(`bids`.`amount` > 0)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` char(36) NOT NULL,
	`customer_id` char(36),
	`guest_token_hash` char(64),
	`customer_name` varchar(100) NOT NULL,
	`customer_contact` varchar(150),
	`status` enum('bot','waiting','admin','resolved') NOT NULL DEFAULT 'bot',
	`bot_enabled` boolean NOT NULL DEFAULT true,
	`unread_by_admin` int NOT NULL DEFAULT 0,
	`unread_by_customer` int NOT NULL DEFAULT 0,
	`pending_action` json,
	`consult` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversations_guest_token_uq` UNIQUE(`guest_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` char(36) NOT NULL,
	`conversation_id` char(36) NOT NULL,
	`sender` enum('customer','bot','admin','system') NOT NULL,
	`text` text NOT NULL,
	`author_id` char(36),
	`author_name` varchar(100),
	`quick_replies` json,
	`links` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` char(36) NOT NULL,
	`actor_id` char(36),
	`actor_name` varchar(100) NOT NULL,
	`action` varchar(60) NOT NULL,
	`target_type` varchar(40) NOT NULL,
	`target_id` varchar(64),
	`detail` json,
	`ip` varchar(45),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` char(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(200) NOT NULL,
	`excerpt` varchar(500) NOT NULL,
	`cover_image` varchar(512) NOT NULL DEFAULT '',
	`category` varchar(50) NOT NULL,
	`tags` json NOT NULL,
	`author_name` varchar(100) NOT NULL,
	`published_at` datetime(3) NOT NULL,
	`reading_minutes` int NOT NULL,
	`view_count` int NOT NULL DEFAULT 0,
	`sections` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` char(36) NOT NULL,
	`full_name` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`phone` varchar(30) NOT NULL DEFAULT '',
	`subject` varchar(150) NOT NULL,
	`message` text NOT NULL,
	`ip` varchar(45),
	`handled_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` char(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`unsubscribed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_subscribers_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`name` varchar(40) NOT NULL,
	`value` json NOT NULL,
	`updated_by` char(36),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `settings_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feeds` ADD CONSTRAINT `feeds_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `items` ADD CONSTRAINT `items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `items` ADD CONSTRAINT `items_feed_id_feeds_id_fk` FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_payments` ADD CONSTRAINT `card_payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD CONSTRAINT `idempotency_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_issues` ADD CONSTRAINT `order_issues_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_issues` ADD CONSTRAINT `order_issues_payment_attempt_id_payment_attempts_id_fk` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_issues` ADD CONSTRAINT `order_issues_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_auction_id_auctions_id_fk` FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_auction_id_auctions_id_fk` FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_attempt_id_payment_attempts_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_attempt_id_payment_attempts_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_coupon_code_coupons_code_fk` FOREIGN KEY (`coupon_code`) REFERENCES `coupons`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_requests` ADD CONSTRAINT `membership_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_requests` ADD CONSTRAINT `membership_requests_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auction_fulfillments` ADD CONSTRAINT `auction_fulfillments_auction_id_auctions_id_fk` FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auction_fulfillments` ADD CONSTRAINT `auction_fulfillments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_leader_id_users_id_fk` FOREIGN KEY (`leader_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bids` ADD CONSTRAINT `bids_auction_id_auctions_id_fk` FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bids` ADD CONSTRAINT `bids_bidder_id_users_id_fk` FOREIGN KEY (`bidder_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_customer_id_users_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `settings` ADD CONSTRAINT `settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_resets_user_idx` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_family_idx` ON `sessions` (`family_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `users_role_created_idx` ON `users` (`role`,`created_at`);--> statement-breakpoint
CREATE INDEX `feeds_retired_number_idx` ON `feeds` (`retired_at`,`number`);--> statement-breakpoint
CREATE INDEX `items_feed_position_idx` ON `items` (`feed_id`,`position`);--> statement-breakpoint
CREATE INDEX `items_status_idx` ON `items` (`status`);--> statement-breakpoint
CREATE INDEX `items_attribute_key_idx` ON `items` (`attribute_key`);--> statement-breakpoint
CREATE INDEX `items_order_idx` ON `items` (`order_id`);--> statement-breakpoint
CREATE INDEX `items_sold_at_idx` ON `items` (`sold_at`);--> statement-breakpoint
CREATE INDEX `media_in_use_created_idx` ON `media` (`in_use`,`created_at`);--> statement-breakpoint
CREATE INDEX `media_sha256_idx` ON `media` (`sha256`);--> statement-breakpoint
CREATE INDEX `idempotency_keys_created_idx` ON `idempotency_keys` (`created_at`);--> statement-breakpoint
CREATE INDEX `order_events_order_at_idx` ON `order_events` (`order_id`,`at`);--> statement-breakpoint
CREATE INDEX `order_issues_status_created_idx` ON `order_issues` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_issues_order_idx` ON `order_issues` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`,`position`);--> statement-breakpoint
CREATE INDEX `order_items_item_idx` ON `order_items` (`item_id`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `orders_auction_idx` ON `orders` (`auction_id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_order_idx` ON `payment_attempts` (`order_id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_status_created_idx` ON `payment_attempts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_events_attempt_idx` ON `payment_events` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `refunds_order_idx` ON `refunds` (`order_id`);--> statement-breakpoint
CREATE INDEX `coupon_redemptions_coupon_user_idx` ON `coupon_redemptions` (`coupon_code`,`user_id`);--> statement-breakpoint
CREATE INDEX `membership_requests_status_created_idx` ON `membership_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `membership_requests_user_idx` ON `membership_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `auctions_start_idx` ON `auctions` (`start_at`);--> statement-breakpoint
CREATE INDEX `auctions_end_idx` ON `auctions` (`end_at`);--> statement-breakpoint
CREATE INDEX `bids_auction_created_idx` ON `bids` (`auction_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bids_bidder_idx` ON `bids` (`bidder_id`);--> statement-breakpoint
CREATE INDEX `conversations_status_updated_idx` ON `conversations` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversations_customer_idx` ON `conversations` (`customer_id`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `blog_posts_published_idx` ON `blog_posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `blog_posts_category_idx` ON `blog_posts` (`category`);--> statement-breakpoint
CREATE INDEX `contact_messages_created_idx` ON `contact_messages` (`created_at`);