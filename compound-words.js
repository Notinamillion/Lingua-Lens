/**
 * Common Chinese Compound Words Dictionary
 *
 * These words should be translated as units, not split into individual characters.
 * Prevents issues like "她的" becoming "she + of" instead of "her".
 *
 * Ported from smart_translator.py
 */

const CompoundWords = {
  // Pronouns and possessives
  '她的': 'her',
  '他的': 'his',
  '我的': 'my',
  '你的': 'your',
  '我们': 'we',
  '他们': 'they',
  '它们': 'they',
  '这个': 'this',
  '那个': 'that',
  '这些': 'these',
  '那些': 'those',

  // Common political/government words
  '预算': 'budget',
  '政府': 'government',
  '议会': 'parliament',
  '国会': 'congress',
  '首相': 'prime minister',
  '总统': 'president',
  '财政': 'financial',
  '部长': 'minister',
  '议员': 'member of parliament',
  '选举': 'election',
  '投票': 'vote',
  '税收': 'tax',
  '经济': 'economy',

  // Common nouns
  '公司': 'company',
  '工作': 'work',
  '学校': 'school',
  '大学': 'university',
  '医院': 'hospital',
  '警察': 'police',
  '军队': 'military',

  // Time words
  '今天': 'today',
  '明天': 'tomorrow',
  '昨天': 'yesterday',
  '现在': 'now',
  '以前': 'before',
  '以后': 'after',
  '时候': 'time',
  '星期': 'week',
  '月份': 'month',
  '年份': 'year',

  // Common verbs/actions
  '可以': 'can',
  '应该': 'should',
  '必须': 'must',
  '需要': 'need',
  '想要': 'want',
  '希望': 'hope',
  '认为': 'think',
  '知道': 'know',
  '相信': 'believe',

  // Common conjunctions and phrases
  '因为': 'because',
  '所以': 'so',
  '但是': 'but',
  '如果': 'if',
  '虽然': 'although',
  '然而': 'however',
  '而且': 'moreover',
  '或者': 'or'
};

/**
 * Check if a Chinese word/phrase is in the compound dictionary
 * @param {string} chineseText - Chinese text to check
 * @returns {string|null} English translation if found, null otherwise
 */
function getCompoundTranslation(chineseText) {
  return CompoundWords[chineseText] || null;
}

/**
 * Check if combining current word with next word(s) forms a compound
 * @param {Array<string>} words - Array of Chinese words
 * @param {number} startIndex - Starting index
 * @param {number} lookahead - Number of words to look ahead (1-2)
 * @returns {Object|null} {compound: string, translation: string, length: number} or null
 */
function findCompound(words, startIndex, lookahead = 2) {
  // Try longest compounds first (lookahead = 2, then 1)
  for (let len = lookahead; len >= 1; len--) {
    if (startIndex + len < words.length) {
      const potentialCompound = words.slice(startIndex, startIndex + len + 1).join('');
      const translation = CompoundWords[potentialCompound];

      if (translation) {
        return {
          compound: potentialCompound,
          translation: translation,
          length: len + 1 // Number of words consumed
        };
      }
    }
  }

  return null;
}

// Make available globally for Chrome extension
if (typeof window !== 'undefined') {
  window.CompoundWords = CompoundWords;
  window.getCompoundTranslation = getCompoundTranslation;
  window.findCompound = findCompound;
}

console.log('[Compound Words] Loaded dictionary with', Object.keys(CompoundWords).length, 'entries');
