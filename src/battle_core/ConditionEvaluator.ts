import type { ActionContext, ConditionFn } from "./types";
import type { BattleCombatant } from "./types";
import { realmStageIndex } from "../role_core/types/playInfo";

export class ConditionEvaluator {
  private registry = new Map<string, ConditionFn>();

  constructor() {
    this.registerDefaults();
  }

  register(key: string, fn: ConditionFn): void {
    this.registry.set(key, fn);
  }

  evaluate(condition: string | undefined, ctx: ActionContext): boolean {
    if (!condition) return true;
    const fn = this.registry.get(condition);
    if (!fn) return true;
    return fn(ctx);
  }

  private registerDefaults(): void {
    this.register("隐匿状态下", (ctx) =>
      ctx.actor.activeEffects.some(e => e.mechanic === "buff_stealth"));

    this.register("法力满时", (ctx) =>
      ctx.actor.currentMp >= ctx.actor.maxMp);

    this.register("法力高于80%时", (ctx) =>
      ctx.actor.currentMp >= ctx.actor.maxMp * 0.8);

    this.register("法力低于20%时", (ctx) =>
      ctx.actor.currentMp <= ctx.actor.maxMp * 0.2);

    this.register("生命低于一定比例时", (ctx) =>
      ctx.actor.currentHp / ctx.actor.maxHp < 0.5);

    this.register("生命越低", () => true);

    this.register("每损失一定比例生命", () => true);

    this.register("每损失一定生命", () => true);

    this.register("敌人生命低于50%", (ctx) =>
      ctx.target ? ctx.target.currentHp / ctx.target.maxHp < 0.5 : false);

    this.register("目标满血时", (ctx) =>
      ctx.target ? ctx.target.currentHp >= ctx.target.maxHp : false);

    this.register("已中毒目标", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "poison") : false);

    this.register("中毒目标", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "poison") : false);

    this.register("对护盾目标", (ctx) =>
      ctx.target ? ctx.target.shield > 0 : false);

    this.register("对护盾敌人", (ctx) =>
      ctx.target ? ctx.target.shield > 0 : false);

    this.register("对感电目标", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "shock") : false);

    this.register("灼烧目标", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "burn") : false);

    this.register("敌人境界低于自身", (ctx) => {
      if (!ctx.target) return false;
      return realmStageIndex(ctx.actor.realm.major, ctx.actor.realm.minor) >
             realmStageIndex(ctx.target.realm.major, ctx.target.realm.minor);
    });

    this.register("敌人越多", (ctx) => ctx.enemies.filter(e => !e.isDead).length > 1);

    this.register("飞剑数量越多", (ctx) => ctx.actor.summons.length > 0);

    this.register("存活队友越多", (ctx) => ctx.allies.filter(a => !a.isDead).length > 1);

    this.register("队友每少一人", (ctx) => ctx.allies.some(a => a.isDead));

    this.register("拥有相同灵根的队友", () => true);

    this.register("每种不同体系功法", () => true);

    this.register("未受到伤害时", (ctx) => ctx.actor.currentHp >= ctx.actor.maxHp);

    this.register("连续使用相同技能时", () => true);

    this.register("连续使用不同技能时", () => true);

    this.register("连续攻击同一目标时", () => true);

    this.register("近身攻击", () => true);

    this.register("周围敌人越多", (ctx) => ctx.enemies.filter(e => !e.isDead).length > 1);

    this.register("周围敌人", (ctx) => ctx.enemies.filter(e => !e.isDead).length > 0);

    this.register("根据自身护盾值", (ctx) => ctx.actor.shield > 0);

    this.register("根据敌方中毒人数", (ctx) => ctx.enemies.filter(e => !e.isDead && e.activeEffects.some(ef => ef.status === "poison")).length > 0);

    this.register("每经历一场战斗", () => true);

    this.register("年龄占比寿元越少", () => true);

    this.register("法力不足时", (ctx) =>
      ctx.actor.currentMp < (ctx.action.type === "gongfa" ? 20 : 0));

    this.register("法力越高伤害越高", () => true);

    this.register("法力越高恢复越多", () => true);

    this.register("根据主角境界提升时", () => true);

    this.register("敌方生命越高", () => true);

    this.register("优先攻击低血量敌人", (ctx) => {
      if (!ctx.target) return false;
      return ctx.target.currentHp / ctx.target.maxHp < 0.5;
    });

    this.register("中毒每层", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "poison") : false);

    this.register("引爆目标所有中毒层数", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "poison") : false);

    this.register("引爆全部雷印", (ctx) =>
      ctx.target ? ctx.target.activeEffects.some(e => e.status === "thunder_seal") : false);

    this.register("引爆所有灼烧和火种", (ctx) =>
      ctx.target ? (ctx.target.activeEffects.some(e => e.status === "burn") ||
        ctx.target.activeEffects.some(e => e.status === "fire_seed")) : false);

    this.register("引爆全场中毒", () => true);

    this.register("消耗全部剑意", (ctx) =>
      ctx.actor.activeEffects.some(e => e.status === "sword_intent"));

    this.register("消耗全部护盾", (ctx) => ctx.actor.shield > 0);

    this.register("消耗全部法力", (ctx) => ctx.actor.currentMp > 0);

    this.register("领域内每把飞剑", (ctx) => ctx.actor.summons.length > 0);

    this.register("中毒效果翻倍", () => true);

    this.register("剑意叠满时", (ctx) => {
      const swordIntent = ctx.actor.activeEffects.find(e => e.status === "sword_intent");
      return swordIntent != null && swordIntent.stacks >= swordIntent.maxStacks;
    });

    this.register("剑意越多伤害越高", (ctx) =>
      ctx.actor.activeEffects.some(e => e.status === "sword_intent"));

    this.register("飞剑数量越多伤害越高", (ctx) => ctx.actor.summons.length > 0);

    this.register("飞剑数量越多", (ctx) => ctx.actor.summons.length > 0);

    this.register("若击杀目标", () => true);

    this.register("队友死亡时", (ctx) => ctx.allies.some(a => a.isDead));

    this.register("队友死亡后", (ctx) => ctx.allies.some(a => a.isDead));

    this.register("敌方死亡时", (ctx) => ctx.enemies.some(e => e.isDead));

    this.register("即死效果", () => Math.random() < 0.1);

    this.register("敌人无法清除中毒且每回合叠加", () => true);

    this.register("敌人因中毒受到伤害时", () => true);

    this.register("敌人中毒时", (ctx) =>
      ctx.enemies.some(e => !e.isDead && e.activeEffects.some(ef => ef.status === "poison")));

    this.register("敌人中毒伤害", () => true);

    this.register("受到火系伤害时", () => true);

    this.register("受到近身攻击时", () => true);

    this.register("受到致命伤时", (ctx) => ctx.actor.currentHp / ctx.actor.maxHp < 0.3);

    this.register("死亡时", (ctx) => ctx.actor.currentHp <= 0);

    this.register("重复攻击自己的敌人", () => true);

    this.register("攻击随机目标两次", () => true);

    this.register("释放时概率不进入冷却", () => Math.random() < 0.3);

    this.register("储存一次技能", () => true);

    this.register("随机重置", () => Math.random() < 0.3);

    this.register("命中后恢复法力", () => true);

    this.register("命中后", () => true);

    this.register("释放技能时有", () => true);

    this.register("暴击必定命中", () => true);

    this.register("必定触发附加效果", () => true);

    this.register("复制敌方最近释放的技能进行攻击", () => true);

    this.register("进入影界连续行动", () => true);
  }
}
