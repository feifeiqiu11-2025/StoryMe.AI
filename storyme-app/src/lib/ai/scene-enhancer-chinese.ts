/**
 * Chinese Language Scene Enhancer
 *
 * Builds prompts optimized for Chinese language story generation
 * Uses age-based reading levels instead of HSK levels
 */

import { StoryTone, ExpansionLevel } from '../types/story';
import type { SceneToEnhance, Character, EnhancedSceneResult } from './scene-enhancer';

/**
 * Get Chinese tone-specific guidelines
 */
function getChineseToneGuidelines(tone: StoryTone): string {
  const guidelines = {
    playful: `
      - 使用活泼、充满活力的语言
      - 包含"开心"、"快乐"、"有趣"、"兴奋"等词
      - 传达轻松愉快的感觉
      - 例如："笑了"、"跳了"、"玩耍"、"欢呼"
    `,
    educational: `
      - 自然地引入学习时刻
      - 使用描述性、信息丰富的词汇
      - 适当解释"为什么"或"怎么样"
      - 例如："发现"、"学到"、"注意到"、"明白了"
    `,
    adventure: `
      - 使用以行动为导向的动态语言
      - 包含勇气和探索的元素
      - 创造兴奋和期待
      - 例如："探索"、"勇敢"、"旅程"、"冒险"、"发现"
    `,
    gentle: `
      - 使用柔和、平静、舒缓的语言
      - 关注平和、舒适的时刻
      - 节奏较慢，反思和宁静的基调
      - 例如："轻轻地"、"温柔地"、"安静"、"温暖"、"平静"
    `,
    silly: `
      - 拥抱荒诞、幽默和俏皮
      - 使用夸张和有趣的意象
      - 让它异想天开、令人咯咯笑
      - 例如："巨大的"、"哎呀"、"摇摇晃晃"、"傻傻的"、"古怪"
    `,
    mystery: `
      - 创造好奇、惊奇和神秘感
      - 使用疑问语言并建立期待
      - 鼓励想象力和发现
      - 例如："好奇"、"秘密"、"发现"、"神秘"、"隐藏"
    `,
    friendly: `
      - 强调关系、团结和温暖
      - 使用包容、合作的语言
      - 突出分享、善良和联系
      - 例如："一起"、"朋友"、"帮助"、"分享"、"善良"、"关心"
    `,
    brave: `
      - 关注克服挑战和建立信心
      - 使用赋权、鼓励的语言
      - 在激发勇气的同时认可情感
      - 例如："尝试"、"自信"、"坚强"、"自豪"、"勇敢"
    `
  };

  return guidelines[tone];
}

/**
 * Get Chinese reading level guidelines based on age
 */
function getChineseReadingLevelGuidelines(readingLevel: number): string {
  if (readingLevel <= 4) {
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
  } else {
    return `
      - 年龄 7-8岁：更丰富的词汇和复杂性
      - 使用描述性词语，多样化的句子结构
      - 句子长度：每句10-15个字
      - 最多3-4句话
      - 例子："小明发现了一个神奇的游乐场，那里所有的秋千在阳光下闪闪发光。"
    `;
  }
}

/**
 * Get target scene count for Chinese stories
 */
function getTargetSceneCount(
  originalSceneCount: number,
  readingLevel: number,
  expansionLevel: ExpansionLevel
): number {
  if (expansionLevel === 'minimal') {
    return originalSceneCount;
  }

  if (expansionLevel === 'smart') {
    if (readingLevel <= 4) return Math.min(Math.ceil(originalSceneCount * 2), 8);
    if (readingLevel <= 6) return Math.min(Math.ceil(originalSceneCount * 2.5), 10);
    return Math.min(Math.ceil(originalSceneCount * 3), 12);
  }

  return Math.max(12, Math.min(Math.ceil(originalSceneCount * 3), 15));
}

/**
 * Get expansion instructions in Chinese
 */
function getExpansionInstructions(
  expansionLevel: ExpansionLevel,
  originalSceneCount: number,
  targetSceneCount: number,
  characterNames: string
): string {
  if (expansionLevel === 'minimal') {
    return `
扩展级别：最小（保持原始故事）
- 必须创建恰好 ${originalSceneCount} 个场景（与输入相同）
- 不要添加新场景或改变故事结构
- 不要添加新角色，只使用：${characterNames}
- 只增强字幕使其适合年龄和清晰
- 保持用户原始故事的精神
- 专注于提高语言质量，而不是添加内容
    `;
  }

  if (expansionLevel === 'smart') {
    return `
扩展级别：智能（基于年龄的扩展）
- 原始场景数：${originalSceneCount}
- 目标场景数：${targetSceneCount}
- 用过渡场景和细节扩展故事
- 如果需要，可以添加次要配角（父母、朋友、宠物）
- 在characterNames中用"(NEW)"标记任何新角色
- 添加感官细节（颜色、声音、感觉）
- 添加适合年龄的简单对话
- 添加小的情节元素（小挑战、发现）
- 保持清晰的故事弧：开始→中间→结束
- 必须保留用户的主要角色：${characterNames}
    `;
  }

  return `
扩展级别：丰富（完整的创意扩展）
- 原始场景数：${originalSceneCount}
- 目标场景数：${targetSceneCount}（12-15个场景）
- 创建具有丰富叙事的完整故事
- 添加对话、角色发展、情感时刻
- 可以添加配角（用"(NEW)"标记）
- 添加迷你故事弧、冲突和解决方案
- 创建详细的场景和氛围
- 添加角色的想法和情感
- 必须保留用户的主要角色：${characterNames}
- 保持原始剧本的核心主题
  `;
}

/**
 * Build Chinese enhancement prompt
 */
export function buildChineseEnhancementPrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone,
  expansionLevel: ExpansionLevel = 'minimal'
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
    characterNames
  );

  return `你是儿童故事书专家，专门创作引人入胜、适合年龄的中文故事。

故事设置：
- 阅读年龄：${readingLevel} 岁
- 故事基调：${storyTone}
- 输入场景数：${scenes.length}
- 目标输出场景数：${targetSceneCount}

角色信息：
${characterDescriptions}

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
