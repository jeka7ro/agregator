export const getSmartSearchWords = (str) => {
    if (!str) return [];
    let s = str.toLowerCase();
    
    // Corecții comune pentru typo-uri românești / la grabă, plus cuvinte lipite
    s = s.replace(/sushiburger/g, 'sushi burger')
         .replace(/sushidog/g, 'sushi dog')
         .replace(/suhiburge\b|suhiburger|suhi\s*burger/g, 'sushi burger')
         .replace(/suhi|susi|shushi/g, 'sushi')
         .replace(/bugr|buger|burge\b/g, 'burger')
         .replace(/somom/g, 'somon')
         .replace(/shrim/g, 'shrimp')
         .replace(/crevte/g, 'crevete');
         
    return s.trim().split(/\s+/).filter(Boolean);
};
