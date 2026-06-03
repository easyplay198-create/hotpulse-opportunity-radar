import hotData from '../mock/hot.json';
import type { HotListResponse } from '../types/hot';

/** 当前读取本地 Mock；后续替换为 fetch('/api/hots') */
export async function getHotList(): Promise<HotListResponse> {
  return hotData as HotListResponse;
}
