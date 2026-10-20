-- 抽奖奖品迁移：奖品类型 + 奖项与概率配置
ALTER TABLE `Reward`
  ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'normal' AFTER `pointsCost`,
  ADD COLUMN `lotteryItems` TEXT NULL AFTER `kind`;
