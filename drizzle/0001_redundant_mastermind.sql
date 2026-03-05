CREATE TABLE `aiPredictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`prediction` text NOT NULL,
	`confidence` decimal(5,2),
	`reasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiPredictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int NOT NULL,
	`outcome` enum('yes','no') NOT NULL,
	`amount` decimal(20,2) NOT NULL,
	`priceAtBet` decimal(5,2) NOT NULL,
	`settledAt` timestamp,
	`payout` decimal(20,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`subcategory` varchar(100),
	`imageUrl` text,
	`yesPrice` decimal(5,2) DEFAULT '50.00',
	`noPrice` decimal(5,2) DEFAULT '50.00',
	`volume24h` decimal(20,2) DEFAULT '0',
	`totalVolume` decimal(20,2) DEFAULT '0',
	`endsAt` timestamp NOT NULL,
	`resolvedAt` timestamp,
	`resolution` enum('yes','no','invalid') DEFAULT 'yes',
	`isLive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `markets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsArticles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`source` varchar(200),
	`url` text,
	`imageUrl` text,
	`summary` text,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsArticles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int,
	`type` enum('market_resolved','price_threshold','market_ending','new_comment','deposit_confirmed','withdrawal_processed') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text,
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(20,2) DEFAULT '0',
	`totalInvested` decimal(20,2) DEFAULT '0',
	`totalReturns` decimal(20,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolios_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `priceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`yesPrice` decimal(5,2) NOT NULL,
	`noPrice` decimal(5,2) NOT NULL,
	`volume` decimal(20,2) DEFAULT '0',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripeTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`type` enum('deposit','withdrawal') NOT NULL,
	`amount` decimal(20,2) NOT NULL,
	`status` enum('pending','completed','failed','cancelled') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeTransactions_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `aiPredictions` ADD CONSTRAINT `aiPredictions_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bets` ADD CONSTRAINT `bets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bets` ADD CONSTRAINT `bets_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `newsArticles` ADD CONSTRAINT `newsArticles_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD CONSTRAINT `priceHistory_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stripeTransactions` ADD CONSTRAINT `stripeTransactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `aiPredictions` (`marketId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `bets` (`userId`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `bets` (`marketId`);--> statement-breakpoint
CREATE INDEX `userId_marketId_idx` ON `bets` (`userId`,`marketId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `comments` (`userId`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `comments` (`marketId`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `markets` (`category`);--> statement-breakpoint
CREATE INDEX `isLive_idx` ON `markets` (`isLive`);--> statement-breakpoint
CREATE INDEX `endsAt_idx` ON `markets` (`endsAt`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `newsArticles` (`marketId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `notifications` (`marketId`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `priceHistory` (`marketId`);--> statement-breakpoint
CREATE INDEX `recordedAt_idx` ON `priceHistory` (`recordedAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `stripeTransactions` (`userId`);--> statement-breakpoint
CREATE INDEX `openId_idx` ON `users` (`openId`);