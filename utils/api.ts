// 로컬 개발 서버 주소. 서버 배포 후 production URL로 교체 예정.
export const API_BASE_URL = "http://192.168.219.104:3001";

export const API_ENDPOINTS = {
  analyze: `${API_BASE_URL}/analyze`,
  analyzeClothes: `${API_BASE_URL}/analyze-clothes`,
  extractProduct: `${API_BASE_URL}/extract-product`,
} as const;
