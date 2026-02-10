/**
 * Chinese Language Scene Enhancer
 *
 * Builds prompts optimized for Chinese language story generation
 * Uses age-based reading levels instead of HSK levels
 */

import { StoryTone, ExpansionLevel } from '../types/story';
import type { SceneToEnhance, Character, EnhancedSceneResult } from './scene-enhancer';
import type { StoryArchitecture } from './story-templates';

/**
 * Get Chinese tone-specific guidelines.
 * Matches English version: 4 active tones (playful absorbs silly, adventure absorbs brave).
 */
function getChineseToneGuidelines(tone: StoryTone): string {
  const guidelines: Record<string, string> = {
    playful: `
      - 使用活泼、充满活力的语言
      - 包含"开心"、"快乐"、"有趣"、"兴奋"等词
      - 传达轻松愉快的感觉
      - 拥抱幽默和俏皮，使用夸张和有趣的意象
      - 例如："笑了"、"跳了"、"玩耍"、"欢呼"、"哎呀"、"古怪"
    `,
    educational: `
      - 自然地引入学习时刻
      - 使用描述性、信息丰富的词汇
      - 适当解释"为什么"或"怎么样"
      - 例如："发现"、"学到"、"注意到"、"明白了"
    `,
    adventure: `
      - 使用以行动为导向的动态语言
      - 包含勇气、探索和克服挑战的元素
      - 创造兴奋和期待，在激发勇气的同时认可情感
      - 例如："探索"、"勇敢"、"旅程"、"冒险"、"发现"、"自信"、"坚强"
    `,
    friendly: `
      - 强调关系、团结和温暖
      - 使用包容、合作的语言
      - 突出分享、善良和联系
      - 例如："一起"、"朋友"、"帮助"、"分享"、"善良"、"关心"
    `,
  };

  return guidelines[tone] || guidelines.playful;
}

/**
 * Get Chinese reading level guidelines based on age.
 * Supports ages 1-12 with Lexile approximation.
 */
function getChineseReadingLevelGuidelines(readingLevel: number): string {
  if (readingLevel <= 2) {
    return `
      - 年龄 1-2岁：最简单的语言
      - 只使用单字或2-3个字的短语
      - 句子长度：1-3个字
      - 最多1-2个短语
      - 例子："狗狗！" 或 "妈妈。球球。"
    `;
  } else if (readingLevel <= 4) {
    return `
      - 年龄 3-4岁：非常简单的语言
      - 只使用简单的词汇（1-2个字的词）
      - 句子长度：每句3-5个字
      - 最多2句话
      - 例子："小明玩。他很开心。"
    `;
  } else if (readingLevel === 5) {
    return `
      - 年龄 5岁：简单清晰的语言
      - 主要使用简单词汇
      - 句子长度：每句5-8个字
      - 最多2-3句话
      - 例子："小明去公园。他玩得很开心！"
    `;
  } else if (readingLevel === 6) {
    return `
      - 年龄 6岁：扩展词汇
      - 更多词汇变化，一些复合词
      - 句子长度：每句8-12个字
      - 最多3句话
      - 例子："小明在阳光明媚的公园里和朋友们一起玩。"
    `;
  } else if (readingLevel <= 8) {
    return `
      - 年龄 7-8岁：更丰富的词汇和复杂性
      - 使用描述性词语，多样化的句子结构
      - 句子长度：每句10-15个字
      - 最多3-4句话
      - 例子："小明发现了一个神奇的游乐场，那里所有的秋千在阳光下闪闪发光。"
    `;
  } else if (readingLevel <= 10) {
    return `
      - 年龄 9-10岁：复杂叙事
      - 使用丰富的词汇、比喻和描述性细节
      - 句子长度：每句12-20个字
      - 最多4-5句话
      - 包含角色思想、对话和情感
      - 例子："小明站在森林的边缘，犹豫着是否有足够的勇气去寻找奶奶提到的那条隐藏的瀑布。"
    `;
  } else {
    return `
      - 年龄 11-12岁：高级叙事
      - 使用丰富的词汇、复杂句式和文学技巧
      - 句子长度：每句15-25个字
      - 最多5-6句话
      - 包含潜台词、角色动机和主题深度
      - 例子："那张旧地图被夹在图书馆的书里已经几十年了，褪色的墨迹描绘出一条镇上无人记得的小径——但小明决心要追寻它。"
    `;
  }
}

/**
 * Get target scene count for Chinese stories.
 * Matches English logic: as_written (exact), light/rich (10-15 scenes).
 */
function getTargetSceneCount(
  originalSceneCount: number,
  readingLevel: number,
  expansionLevel: ExpansionLevel
): number {
  if (expansionLevel === 'as_written') {
    return originalSceneCount;
  }

  if (expansionLevel === 'light') {
    // Light: 10-12 scenes (flexible)
    return Math.max(10, Math.min(12, Math.max(originalSceneCount, 10)));
  }

  // Rich: Always 15 scenes for deeper plot and more images
  return 15;
}

/**
 * Get expansion instructions in Chinese.
 * Matches English logic: as_written, light (flexible architecture), rich (strict architecture).
 */
function getExpansionInstructions(
  expansionLevel: ExpansionLevel,
  originalSceneCount: number,
  targetSceneCount: number,
  characterNames: string,
  architecture?: StoryArchitecture
): string {
  if (expansionLevel === 'as_written') {
    return `
扩展级别：原样保留（完全保持用户的原始脚本）
- 必须创建恰好 ${originalSceneCount} 个场景（与输入相同）
- 不要添加新场景或改变故事结构
- 不要添加新角色，只使用：${characterNames}
- 字幕：必须使用用户的原始文本，一字不改——不要调整词汇、句子结构或标点
  - 孩子自己写的文字，要完全保留他们的表达
  - 不要根据阅读水平调整——用户选择"原样保留"就是要保持原文不变
  - 只修正明显的错别字，其他不做任何改动
- 图像提示：为图像生成创建生动的视觉描述（在这里添加细节）
- 完全保持用户原始故事的精神
    `;
  }

  if (expansionLevel === 'light') {
    const architectureGuidance = architecture ? `
故事架构（灵活指导）：
故事应遵循此叙事结构，但如果用户的脚本有不同的流程，可以进行调整：

${architecture.requiredBeats.map((beat, i) => `${i + 1}. ${beat}`).join('\n')}

场景流程：
${architecture.sceneFlowGuidance}

尝试包含这些教学元素：
${architecture.pedagogicalCheckpoints.map((cp, i) => `• ${cp}`).join('\n')}

重要：将此架构作为指导。如果用户的脚本已经有好的流程，增强它而不是强制这个结构。
` : '';

    return `
扩展级别：轻度扩展
- 原始场景数：${originalSceneCount}
- 目标场景数：${targetSceneCount}（10-12个场景）
- 增强字幕使其适合年龄、清晰、引人入胜
- 添加过渡场景以改善故事流畅性并完成叙事弧
- 如果需要，可以添加次要配角（父母、朋友、宠物）
- 在characterNames中用"(NEW)"标记任何新角色
- 添加感官细节（颜色、声音、感觉）
- 添加适合年龄的简单对话
- 必须保留用户的主要角色：${characterNames}
${architectureGuidance}`;
  }

  // Rich expansion
  const architectureGuidance = architecture ? `
故事架构（必需结构）：
此故事必须遵循此叙事弧。重新组织用户的场景以适应此结构：

${architecture.requiredBeats.map((beat, i) => `${i + 1}. ${beat}`).join('\n')}

场景流程要求：
${architecture.sceneFlowGuidance}

必需的教学检查点（必须全部满足）：
${architecture.pedagogicalCheckpoints.map((cp, i) => `✓ ${cp}`).join('\n')}

使用架构的任务：
1. 阅读用户的脚本并识别已存在的故事节拍
2. 重新组织场景以适应上述所需的叙事弧
3. 在需要的地方添加场景以完成缺失的节拍
4. 确保所有教学检查点都得到满足
5. 创建从开始→中间→结束的逻辑流程
6. 用户的脚本可能不完整或无序 - 您的工作是正确构建它，同时保留他们的核心想法和角色

关键：强化因果逻辑
- 永远不要在不展示过程的情况下从问题跳到解决方案
- 添加过渡场景，展示事情如何发生以及为什么发生
- 使用明确的因果关系："因为X发生了，Y出现" 或 "X做Y，导致Z"
- 在行动之前展示角色动机（角色为什么决定做某事？）
- 展示过程，而不仅仅是结果（如果魔法修复了某事，展示如何使用）
- 每个场景应该逻辑地引向下一个场景 - 没有突然的跳跃

良好逻辑流的例子：
✓ "龙喷火 → 火焰触及水面 → 水变色 → 角色注意到变化"
✓ "角色看到问题 → 感到担忧 → 决定帮助 → 采取行动"

不良逻辑流的例子（避免这些）：
✗ "龙喷火。海洋变紫色。"（缺少：火如何影响水）
✗ "龙感到悲伤。海洋变蓝。"（缺少：龙做了什么来修复它？）
✗ "角色很担心。龙使用了魔法！"（缺少：为什么/如何龙知道使用魔法？）
` : '';

  return `
扩展级别：丰富（完整的创意扩展）
- 原始场景数：${originalSceneCount}
- 目标场景数：${targetSceneCount}（恰好15个场景，以获得更深入的情节和更多图像）
- 创建具有丰富叙事和清晰因果流程的完整故事
- 添加对话、角色发展、情感时刻
- 可以添加配角（用"(NEW)"标记）
- 添加迷你故事弧、冲突和解决方案
- 创建详细的场景和氛围
- 添加角色的想法和情感
- 展示事件的过程，而不仅仅是结果
- 必须保留用户的主要角色：${characterNames}
- 保持原始剧本的核心主题
${architectureGuidance}`;
}

/**
 * Build Chinese enhancement prompt.
 * Accepts optional templateBasePrompt for story category guidance.
 */
export function buildChineseEnhancementPrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone,
  expansionLevel: ExpansionLevel = 'as_written',
  templateBasePrompt?: string,
  storyArchitecture?: StoryArchitecture
): string {
  const characterNames = characters.map(c => c.name).join('、');
  const characterDescriptions = characters
    .map(c => `- ${c.name}：${c.description}`)
    .join('\n');

  const targetSceneCount = getTargetSceneCount(scenes.length, readingLevel, expansionLevel);
  const expansionInstructions = getExpansionInstructions(
    expansionLevel,
    scenes.length,
    targetSceneCount,
    characterNames,
    storyArchitecture
  );

  return `你是儿童故事书专家，专门创作引人入胜、适合年龄的中文故事。

故事设置：
- 阅读年龄：${readingLevel} 岁
- 故事基调：${storyTone}
- 输入场景数：${scenes.length}
- 目标输出场景数：${targetSceneCount}

角色信息：
${characterDescriptions}
${templateBasePrompt ? `
故事类别指导：
${templateBasePrompt}
` : ''}
${expansionInstructions}

"${storyTone.toUpperCase()}"基调指南：
${getChineseToneGuidelines(storyTone)}

阅读级别指南：
${getChineseReadingLevelGuidelines(readingLevel)}

你的任务：
对于提供的每个场景，你必须创建两个不同的文本：

1. 增强的图像提示（用于AI图像生成）：
   - **重要：图像提示必须用英文编写，以便DALL-E/Fal.ai获得最佳结果**
   - 添加生动的视觉细节（颜色、光线、面部表情、肢体语言）
   - 完全保留所有角色名称：${characterNames}
   - 包括构图指导（前景/背景元素）
   - 指定场景细节、天气、时间等
   - 保持描述性和视觉化（少于200个字符）
   - 不要在这里包含字幕文本 - 这纯粹用于图像生成
   - **重要：根据主题为角色穿上合适的服装**：
     * 圣诞节/冬天故事 → 舒适的冬装、圣诞毛衣、圣诞帽、暖和的外套
     * 夏天/海滩故事 → 泳装、短裤、T恤、遮阳帽
     * 万圣节故事 → 各种服装（巫师、超级英雄、公主等）
     * 生日派对 → 派对服装、生日帽
     * 睡前故事 → 睡衣、睡袍
     * 上学故事 → 校服或休闲服装
     * 默认 → 适合活动的休闲服装
   - 在同一个故事的所有场景中保持服装一致

2. 故事字幕（用于故事书PDF）：
   - **字幕必须用中文编写**
   - 适合${readingLevel}岁儿童的文字
   - 始终如一地应用"${storyTone}"基调
   - 严格遵循阅读级别指南
   - 保持适合幼儿的情感共鸣
   - 最多2-3句话（年龄较小的孩子要更短）
   - 这是孩子们将在书中阅读的内容

关键规则：
- 始终完全保留角色名称
- 增强提示应该是视觉化和描述性的（英文）
- 字幕应该适合年龄并符合基调（中文）
- 这两个输出服务于不同的目的 - 保持它们的区别
- 在故事的所有场景中保持一致性

输入场景：
${scenes.map((s, i) => `场景 ${s.sceneNumber}："${s.rawDescription}"（角色：${s.characterNames.join('、') || '全部'}）`).join('\n')}

输出格式：
返回一个包含 ${targetSceneCount} 个场景的有效JSON数组，使用这个确切的结构：
[
  {
    "sceneNumber": 1,
    "title": "简短的场景标题（中文，5-7个字）",
    "enhanced_prompt": "detailed visual description in ENGLISH preserving character names",
    "caption": "适合年龄的中文故事文本，符合${storyTone}基调",
    "characterNames": ["Emma", "妈妈"]
  },
  {
    "sceneNumber": 2,
    "title": "...",
    "enhanced_prompt": "...",
    "caption": "...",
    "characterNames": ["Emma"]
  }
]

重要提醒：
- 返回数组中恰好 ${targetSceneCount} 个场景
- 为每个场景包含"title"（中文标题）
- enhanced_prompt 必须是英文（用于图像生成）
- caption 必须是中文（用于故事书）
- 列出每个场景中出现的所有角色名称
- 如果添加了新角色，用"(NEW)"后缀标记
- 只返回JSON数组，不要其他文本。`;
}

/**
 * Parse Chinese enhancement response
 */
export function parseChineseEnhancementResponse(
  response: string,
  originalScenes: SceneToEnhance[]
): EnhancedSceneResult[] {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed.map((item: any, index: number) => {
      const originalScene = originalScenes[Math.min(index, originalScenes.length - 1)];

      return {
        sceneNumber: item.sceneNumber || (index + 1),
        title: item.title || `场景 ${index + 1}`,
        raw_description: originalScene?.rawDescription || item.caption,
        enhanced_prompt: item.enhanced_prompt || item.caption,
        caption: item.caption || originalScene?.rawDescription || '无描述',
        characterNames: item.characterNames || originalScene?.characterNames || [],
        isNewCharacter: item.characterNames?.some((name: string) => name.includes('(NEW)')) || false
      };
    });

  } catch (error) {
    console.error('Failed to parse Chinese AI response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse Chinese AI enhancement response');
  }
}
