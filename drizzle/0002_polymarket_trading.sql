CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int NOT NULL,
	`outcome` enum('yes','no') NOT NULL,
	`side` enum('buy','sell') NOT NULL,
	`shares` decimal(24,8) NOT NULL,
	`priceCents` decimal(6,2) NOT NULL,
	`notionalUsd` decimal(20,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int NOT NULL,
	`outcome` enum('yes','no') NOT NULL,
	`positionShares` decimal(24,8) NOT NULL,
	`avgPriceCents` decimal(8,4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `positions_id` PRIMARY KEY(`id`),
	CONSTRAINT `positions_user_market_outcome` UNIQUE(`userId`,`marketId`,`outcome`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlists_user_market` UNIQUE(`userId`,`marketId`)
);
--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `trades_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `trades_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlists` ADD CONSTRAINT `watchlists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlists` ADD CONSTRAINT `watchlists_marketId_markets_id_fk` FOREIGN KEY (`marketId`) REFERENCES `markets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trades_userId_idx` ON `trades` (`userId`);--> statement-breakpoint
CREATE INDEX `trades_marketId_idx` ON `trades` (`marketId`);--> statement-breakpoint
CREATE INDEX `trades_createdAt_idx` ON `trades` (`createdAt`);--> statement-breakpoint
CREATE INDEX `positions_userId_idx` ON `positions` (`userId`);--> statement-breakpoint
CREATE INDEX `positions_marketId_idx` ON `positions` (`marketId`);--> statement-breakpoint
CREATE INDEX `watchlists_userId_idx` ON `watchlists` (`userId`);
