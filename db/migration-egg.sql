-- 彩蛋功能数据库迁移（在已有数据库上执行一次）
ALTER TABLE `TaskTemplate`
  ADD COLUMN `eggEnabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `isActive`,
  ADD COLUMN `eggRewards` TEXT NULL AFTER `eggEnabled`;

ALTER TABLE `Task`
  ADD COLUMN `eggRewardType` VARCHAR(191) NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN `eggRewardValue` VARCHAR(191) NULL DEFAULT NULL AFTER `eggRewardType`,
  ADD COLUMN `eggRevealedAt` DATETIME(3) NULL DEFAULT NULL AFTER `eggRewardValue`;
