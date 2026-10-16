-- 例程模板第三版迁移：子任务周期（每日/每周/每月）与按周期结算
ALTER TABLE `TemplateSubtask`
  ADD COLUMN `period` VARCHAR(191) NOT NULL DEFAULT 'daily' AFTER `quantity`;

ALTER TABLE `RoutineSettlement`
  ADD COLUMN `subtaskId` VARCHAR(191) NULL AFTER `childId`;

ALTER TABLE `RoutineSettlement`
  DROP INDEX `RoutineSettlement_unique_idx`,
  ADD UNIQUE KEY `RoutineSettlement_unique2_idx` (`childId`, `subtaskId`, `settledDate`);
