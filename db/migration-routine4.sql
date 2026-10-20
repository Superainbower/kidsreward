-- 例程结算合并：把历史上同一批次的多条结算积分流水合并为一条
-- （子任务级结算记录 RoutineSettlement 保留不动，只合并记录页展示的积分流水）
CREATE TEMPORARY TABLE `_routine_settle_merge` AS
SELECT MIN(`id`) AS keepId, `familyId`, `userId`, `reason`, SUM(`amount`) AS total
  FROM `PointsTransaction`
 WHERE `type` = 'routine_settle'
 GROUP BY `familyId`, `userId`, `reason`
HAVING COUNT(*) > 1;

UPDATE `PointsTransaction` p
  JOIN `_routine_settle_merge` m ON p.`id` = m.keepId
   SET p.`amount` = m.total;

DELETE p FROM `PointsTransaction` p
  JOIN `_routine_settle_merge` m
    ON p.`familyId` = m.familyId
   AND p.`userId` = m.userId
   AND p.`reason` = m.reason
   AND p.`type` = 'routine_settle'
   AND p.`id` <> m.keepId;

DROP TEMPORARY TABLE `_routine_settle_merge`;
