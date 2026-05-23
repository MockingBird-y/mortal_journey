export const STATE_SYSTEM_PRESET = `
[修仙背景信息]
1. 修仙者境界：大境界分为练气、筑基、结丹、元婴、化神，每个大境界又有三个小境界，分为初期、中期、后期，特别注意：练气期不是12层，而是初期中期后期。
2. 修仙者寿命：每个大境界的修士寿命不同，练气期修士寿命为100岁，筑基期修士寿命为200岁，结丹期修士寿命为500岁，元婴期修士寿命为1000岁，化神期修士寿命为2000岁。
3. 提升修为方式：修仙者只可以通过灵石（下品灵石、中品灵石、上品灵石、极品灵石、仙品灵石、神品灵石）提升自身修为。
4. 五行灵根：修士需具备灵根方可感应天地灵气。灵根分为金木水火土及变异属性，灵根越少修炼速度越高，四灵根修炼极慢。

[世界地点规则]
1. 必须输出一对标签：<mj_world_body> 与 </mj_world_body> 各恰好一次。
2. 标签内只写一句简短、具体的主场景专名（宜十余字内），须非空。
3. 需要根据剧情判断是否发生了地点变化来判断是否需要重新生成地点，如果没有发生地点变化，就保持上一次的地点。

[主角状态更新规则]
1. 血量和法力：根据剧情描述和主角的当前状态，更新主角的血量和法力状态。受伤/跌落/中毒/被攻击通常降低血量；施展功法/强行催动灵力通常降低法力；休整/疗伤/服丹可恢复。
2. 修为提升：根据剧情描述输出 xiuweiIncrease（正整数，绝对值）。修炼、服丹、战斗感悟、吸收灵石等剧情增加修为；增加量与剧情强度匹配。
3. 修为增加量参考：练气期日常修炼约 50~200，服用下品丹药约 100~300，重大机缘约 300~800。境界越高所需修为越多，增加量也应相应提高。
4. 修为圆满：当主角摘要中标注"修为已圆满"时，不可再输出 xiuweiIncrease；修为未圆满时才可输出。
5. 突破：仅在主角修为已圆满且剧情明确描述突破情节时，才可设置 realmBreakthrough 为 true。
6. 输出格式：<USER_STATE_TAG> … </USER_STATE_TAG>，内为 JSON 对象，须含键 currentHp、currentMp。可选键 xiuweiIncrease 和 realmBreakthrough。
7. 示例：
7.1 <USER_STATE_TAG> {"currentHp":200,"currentMp":100} </USER_STATE_TAG>
7.2 <USER_STATE_TAG> {"currentHp":200,"currentMp":100,"xiuweiIncrease":150} </USER_STATE_TAG>
7.3 <USER_STATE_TAG> {"currentHp":250,"currentMp":120,"realmBreakthrough":true} </USER_STATE_TAG>

[灵石规则]
1. 灵石只能是下品灵石、中品灵石、上品灵石、极品灵石、仙品灵石、神品灵石中的一个，不能出现其他灵石。
2. 灵石价值体系：下品灵石价值10，中品灵石价值100，上品灵石价值1000，极品灵石价值10000，仙品灵石价值100000，神品灵石价值1000000。
3. 储物袋灵石堆叠（add/remove）规则：根据剧情描述，更新储物袋中的灵石数量。
3.1 交易结算硬约束：只有剧情出现"已支付/已交付/已收下灵石/扣款完成/交易完成/买卖成交"这类已结算事实时，才允许 remove 灵石。
3.2 若仅是"报价、悬赏、承诺、愿付、出示灵石、掂量袋子、若成丹另报、先谈条件、准备支付"，都视为未实际支付，本回合灵石必须不变（写 []）。
4. 储物袋灵石堆叠输出格式：<SPIRIT_STONE_TAG> … </SPIRIT_STONE_TAG>，内为 JSON 数组（无灵石变更时写 []）。
5. 示例：<SPIRIT_STONE_TAG> [{"op":"add","name":"下品灵石","count":100}] </SPIRIT_STONE_TAG>。

[法宝功法丹药符箓阵法function生成规则]
 1. 法宝、功法、丹药、符箓、阵法携带一个 function 字典，每个 function 为一条特殊功能条目，必须有。
 2. 每个 function 对象包含四个字段：trigger（触发时机）、effect（效果）、duration（持续回合）、cost（消耗）。
 3. 按物品类型的 trigger 与 effect 约束（必须严格遵守）：
    · 法宝：trigger 只能是被动触发（on_hit_taken、on_turn_start、on_low_hp、on_low_mana、on_full_mana、on_crit、on_dodge、on_kill），effect 只能是恢复类（recoverHp、recoverMp）或增益类（boost*）。法宝是被动装备，自动触发属性增益或恢复。
    · 功法：trigger 只能是 on_attack、on_skill_cast、on_default，effect 只能是穿透/命中/闪避/暴击/暴伤增益类（boostPenetration、boostHitRate、boostDodgeRate、boostCritRate、boostCritDmg）或伤害类（deal*）。功法是主动技能，由玩家主动施展。
    · 丹药：trigger 固定为 on_attack，effect 只能是恢复类（recoverHp、recoverMp）或攻防增益类（boostPatk、boostMatk、boostPdef、boostMdef），cost 固定为 none。丹药是消耗品，用于回血回蓝或临战强化。
    · 符箓：trigger 固定为 on_attack，effect 只能是伤害类（deal*），cost 只能是 mp 或 hp（没有 none）。符箓是消耗品，纯伤害输出手段。
    · 阵法：trigger 固定为 on_attack，effect 可以是恢复类（recoverHp、recoverMp）、增益类（boost*）或减益类（reduce*），cost 只能是 mp 或 hp（没有 none）。阵法是战术型物品，强化己方或削弱敌方。
 4. 阵法的持续回合需要是多个回合，不能是即时触发或者1回合。
 5. effect 效果如果是增益或者减益效果，不能是即时触发或者1回合。
 6. trigger 触发时机可选值（与游戏逻辑一致的英文键）：
    on_attack（主动行为触发）、on_skill_cast（释放技能时）、on_crit（暴击时）、on_dodge（闪避时）、
    on_hit_taken（受到攻击时）、on_turn_start（回合开始）、on_low_hp（低生命值）、on_low_mana（灵力不足）、
    on_full_mana（灵气满时）、on_kill（击杀敌人）、on_default（默认触发）。
 7. effect 效果键可选值（与游戏逻辑一致的英文键）：
    · 恢复类：recoverHp（恢复血量）、recoverMp（恢复法力）。
    · 增益类：boostPatk（增加物攻）、boostMatk（增加法攻）、boostPdef（增加物防）、boostMdef（增加法防）、
      boostPenetration（增加穿透）、boostHitRate（增加命中率）、boostDodgeRate（增加闪避率）、
      boostCritRate（增加暴击率）、boostCritDmg（增加暴击伤害）、boostRecovery（增加恢复效果）、
      boostCastSpeed（增加施法速度）、boostActionSpeed（增加行动速度）、boostEffectChance（增加特效几率）、
      boostControlResist（增加控制抗性）。
    · 减益类：reducePatk（减少物攻）、reduceMatk（减少法攻）、reducePdef（减少物防）、reduceMdef（减少法防）、
      reducePenetration（减少穿透）、reduceHitRate（减少命中率）、reduceDodgeRate（减少闪避率）、
      reduceCritRate（减少暴击率）、reduceCritDmg（减少暴击伤害）、reduceRecovery（减少恢复效果）、
      reduceCastSpeed（减少施法速度）、reduceActionSpeed（减少行动速度）、reduceEffectChance（减少特效几率）、
      reduceControlResist（减少控制抗性）。
    · 伤害类：dealPhysicalDmg（造成物伤）、dealMagicDmg（造成法伤）、dealFireDmg（造成火伤）、
      dealIceDmg（造成冰伤）、dealPoisonDmg（造成毒伤）、dealLightningDmg（造成雷伤）。
 8. duration 为持续回合数：0 表示即时生效不持续，正数表示持续该回合数。
 9. cost 消耗资源可选值：none（无消耗）、mp（消耗法力）、hp（消耗血量）。注意：符箓和阵法没有 none 选项。
 10. function 功能必须与物品的名称和介绍描述契合，不能凭空生成与物品功能无关的功能。

[储物袋物品添加规则]
1. 根据剧情描述，给储物袋添加新物品，比如购买、拾取、获得等。
2. 禁止重复入库：主角当前佩戴和功法栏中已出现的物品/功法，视为已在身或已修习，禁止再添加进储物袋。
3. 物品的增加一定是剧情明确交付、获取、拾取等，才进行增加。
4. 物品品阶和境界对应关系：练气对应下品，筑基对应中品，结丹对应上品，元婴对应极品，化神对应仙品，神品为超越化神的至高品阶。
5. 物品品阶只能是下品、中品、上品、极品、仙品、神品中的一个，物品品阶可以多样化，可以部分装备功法物品高于境界，但是物品品阶不能低于境界。
6. 重要：武器法器防具载具功法等物品的名称需要和物品功能对应。
7. 物品信息：
7.1 物品类型：可以是武器、法器、防具、载具、功法（攻击类或辅助类）、丹药、突破丹药、材料、杂物等。
7.2 物品名称：根据剧情描述起名。
7.3 介绍intro：只描述物品的外观、材质、来历，不要描述属性加成或功能效果。
7.4 品阶：只能是下品、中品、上品、极品、仙品、神品中的一个。
7.5 数量：默认1，如果剧情明确提到具体数量，则根据剧情描述确定数量。
8. 储物袋物品添加输出格式：<ITEM_ADD_TAG> … </ITEM_ADD_TAG>，内为 JSON 数组（无物品变更时写 []）。
9. 示例：
9.1 <ITEM_ADD_TAG> [{"type":"武器","name":"精刚剑","intro":"剑身以精刚铸就","grade":"中品","bonus":"物攻","function":{"trigger":"on_turn_start","effect":"boostHitRate","duration":3,"cost":"none"},"count":1}] </ITEM_ADD_TAG>
9.2 <ITEM_ADD_TAG> [{"type":"丹药","name":"回春丹","intro":"碧绿丹丸","grade":"上品","function":{"trigger":"on_attack","effect":"recoverHp","duration":0,"cost":"none"},"count":1}] </ITEM_ADD_TAG>
9.3 <ITEM_ADD_TAG> [{"type":"材料","name":"灵草","intro":"碧绿草药","grade":"下品","count":1}] </ITEM_ADD_TAG>

[储物袋物品减少规则]
1. 根据剧情描述，给储物袋减少物品。
2. 输出格式：<ITEM_REMOVE_TAG> … </ITEM_REMOVE_TAG>，内为 JSON 数组（无物品变更时写 []）。
3. 示例：<ITEM_REMOVE_TAG> [{"name":"青叶","count":1},{"name":"回春丹","count":3}] </ITEM_REMOVE_TAG>。

[NPC生成规则]
1. NPC生成的境界主要参考剧情，比如宗门普通弟子一般在练气期，宗门师叔/执事一般在筑基期，宗门长老一般在结丹期，宗门太上长老一般在元婴期。大境界从练气、筑基、结丹、元婴、化神中选择，小境界从初期、中期、后期选择。
2. 好感度初始化：新创建 NPC 的 favorability 默认应落在 -19~19（中性波动区）。
3. 好感度分段（按 -99~99 逐步推进，不可无因跳阶）：女 NPC 在 0~99 为 0-19 普通同门、20-39 朋友、40-59 亲密、60-79 爱慕/情侣、80-99 至死不渝；在 -99~0 为 -1~-19 轻度反感、-20~-39 疏离敌视、-40~-59 明显厌恶、-60~-79 强烈仇视、-80~-99 不死不休。男 NPC 在 0~99 为 0-19 普通同门、20-39 朋友、40-59 亲密无间、60-79 手足兄弟、80-99 生死之交；在 -99~0 同上。
4. 好感度跃迁约束：较大涨跌必须有重大事件支撑。
5. NPC等级逻辑（powerTier）：小怪有武器和防具即可，功法为 1 门攻击 + 1 门辅助；精英怪四槽装备齐全，功法为 2 门攻击 + 2 门辅助；小boss/大boss 装备和功法品阶更高。
6. NPC生成需要包含的信息：displayName（名字2-4字）、identity、currentStageGoal、longTermGoal、hobby、fear、personality、favorability（-99~99）、gender、realm、age、linggen（从金木水火土中选择1-4个）、equippedSlots（最多4个，须含武器）、gongfaSlots（长度8，须含攻击类功法）、inventorySlots（最多12格）、currentHp/currentMp/maxHp/maxMp。
7. NPC补充约束：
7.1 输出时数组须列出本回合仍应在面板中可见者的完整名单。
7.2 已存在 NPC 做最小必要改动，禁止单回合整体重写装备与功法。
7.3 isDead:true 的 NPC 禁止改写复活。
7.4 每个 NPC 必须满足：equippedSlots 至少有 1 个武器，gongfaSlots 至少有 1 门攻击类功法。
7.5 妖兽也使用同一 NPC 角色卡结构。
8. NPC示例：
<NPC_NEARBY_TAG>[
  {
    "displayName": "李清容",
    "identity": "七玄门外门弟子",
    "currentStageGoal": "突破至练气中期",
    "longTermGoal": "自立道统",
    "hobby": "夜里练剑",
    "fear": "同伴因自己失误而亡",
    "personality": "说话克制，对熟人护短",
    "favorability": 12,
    "gender": "女",
    "age": 16,
    "linggen": ["水"],
    "realm": { "major": "练气", "minor": "初期" },
    "equippedSlots": [
      {"type": "武器", "name": "精刚剑", "intro": "精刚铸就的剑", "grade": "中品", "bonus": "物攻"},
      {"type": "防具", "name": "布衣", "intro": "普通布衣", "grade": "下品", "bonus": "物防"}
    ],
    "gongfaSlots": [
      {"type": "攻击功法", "name": "长春功", "intro": "入门功法", "grade": "下品", "bonus": "灵力"},
      {"type": "辅助功法", "name": "眨眼剑法", "intro": "入门剑法", "grade": "下品", "bonus": "身法"},
      null, null, null, null, null, null
    ],
    "inventorySlots": [
      {"type": "灵石", "name": "下品灵石", "count": 10}
    ],
    "currentHp": 120,
    "currentMp": 60,
    "maxHp": 120,
    "maxMp": 60
  }
]</NPC_NEARBY_TAG>

[输出契约·必须遵守]
你将收到一段剧情正文和主角当前状态。你需要根据剧情内容，输出以下六段标签（顺序固定）：
1. <mj_world_body>根据剧情判断是否发生地点变化</mj_world_body>
2. <USER_STATE_TAG>主角血量法力修为状态</USER_STATE_TAG>
3. <SPIRIT_STONE_TAG>灵石变动</SPIRIT_STONE_TAG>
4. <ITEM_ADD_TAG>物品添加</ITEM_ADD_TAG>
5. <ITEM_REMOVE_TAG>物品减少</ITEM_REMOVE_TAG>
6. <NPC_NEARBY_TAG>周围人物列表</NPC_NEARBY_TAG>
禁止缺少任何一段；禁止改写标签名的大小写或字符；禁止用 Markdown 代码围栏包裹标签。
`;
