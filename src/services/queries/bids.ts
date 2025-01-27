import { bidHistoryKey, itemsByPriceKey, itemsKey } from '$services/keys';
import { client, withLock } from '$services/redis';
import type { CreateBidAttrs, Bid } from '$services/types';
import { DateTime } from 'luxon';
import { getItem } from './items';

export const createBid = async (attrs: CreateBidAttrs) => {
	return withLock(attrs.itemId, async () => {
		// 1) Fetching the item
		// 2) Doing validation
		// 3) Writing some data
		const item = await getItem(attrs.itemId);

		if (!item) {
			throw new Error('Item does not exits');
		}

		if (item.price >= attrs.amount) {
			throw new Error('Bid too low');
		}

		if (item.endingAt.diff(DateTime.now()).toMillis() < 0) {
			throw new Error('Item close to bidding');
		}

		const serialized = serializeHistory(attrs.amount, attrs.createdAt.toMillis());

		return Promise.all([
			client.rPush(bidHistoryKey(attrs.itemId), serialized),
			client.hSet(itemsKey(item.id), {
				bids: item.bids + 1,
				price: attrs.amount,
				highestBidUserId: attrs.userId
			}),
			client.zAdd(itemsByPriceKey(), {
				value: item.id,
				score: attrs.amount
			})
		]);
	});

	// Nhiều lệnh giảm hiệu suất
	// return client.executeIsolated(async (isolatedClient) => {
	// 	await isolatedClient.watch(itemsKey(attrs.itemId));

	// 	const item = await getItem(attrs.itemId);

	// 	if (!item) {
	// 		throw new Error('Item does not exits');
	// 	}

	// 	if (item.price >= attrs.amount) {
	// 		throw new Error('Bid too low');
	// 	}

	// 	if (item.endingAt.diff(DateTime.now()).toMillis() < 0) {
	// 		throw new Error('Item close to bidding');
	// 	}

	// 	const serialized = serializeHistory(attrs.amount, attrs.createdAt.toMillis());

	// 	return isolatedClient
	// 		.multi()
	// 		.rPush(bidHistoryKey(attrs.itemId), serialized)
	// 		.hSet(itemsKey(item.id), {
	// 			bids: item.bids + 1,
	// 			price: attrs.amount,
	// 			highestBidUserId: attrs.userId
	// 		})
	// 		.zAdd(itemsByPriceKey(), {
	// 			value: item.id,
	// 			score: attrs.amount
	// 		})
	// 		.exec();
	// });
};

export const getBidHistory = async (itemId: string, offset = 0, count = 10): Promise<Bid[]> => {
	const startIndex = -1 * offset - count;
	const endIndex = -1 - offset;

	const range = await client.lRange(bidHistoryKey(itemId), startIndex, endIndex);

	return range.map((bid) => deserializeHistory(bid));
};

const serializeHistory = (amount: number, createdAt: number) => {
	return `${amount}:${createdAt}`;
};

const deserializeHistory = (stored: string) => {
	const [amount, createAt] = stored.split(':');

	return {
		amount: parseFloat(amount),
		createdAt: DateTime.fromMillis(parseInt(createAt))
	};
};
