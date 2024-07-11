import { itemsByViewsKey, itemsKey, itemsViewsKey } from '$services/keys';
import { client } from '$services/redis';

export const incrementView = async (itemId: string, userId: string) => {
	// ti le 0.81% error, nhung đánh đổi dung luong toi da chi 12kb !!! (HyperLogsLogs)
	const inserted = await client.pfAdd(itemsViewsKey(itemId), userId);

	if (inserted) {
		return await Promise.all([
			client.hIncrBy(itemsKey(itemId), 'views', 1),
			client.zIncrBy(itemsByViewsKey(), 1, itemId)
		]);
	}
};
