import "dotenv/config";
import { nip19, nip44 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import type { Event } from "nostr-tools/pure";
import {
	finalizeEvent,
	generateSecretKey,
	getPublicKey,
} from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";

function createRumorDM(
	senderSk: Uint8Array,
	receiverHex: string,
	message: string,
): Event {
	const senderPk = getPublicKey(senderSk);
	const now = Math.floor(Date.now() / 1000);
	const rumor = {
		kind: 14,
		created_at: now,
		tags: [["p", receiverHex]],
		content: message,
		pubkey: senderPk,
	};

	const ckHex = nip44.getConversationKey(senderSk, receiverHex);
	const encryptedRumor = nip44.encrypt(JSON.stringify(rumor), ckHex);

	return finalizeEvent(
		{
			kind: 13,
			created_at: now,
			tags: [["p", receiverHex]],
			content: encryptedRumor,
		},
		senderSk,
	);
}

function createGiftwrap(receiverHex: string, sealed: Event): Event {
	const ephSk = generateSecretKey();
	const wrapKey = nip44.getConversationKey(ephSk, receiverHex);
	const encryptedSeal = nip44.encrypt(JSON.stringify(sealed), wrapKey);

	const now = Math.floor(Date.now() / 1000);

	return finalizeEvent(
		{
			kind: 1059,
			created_at: now,
			tags: [["p", receiverHex]],
			content: encryptedSeal,
		},
		ephSk,
	);
}

// sender
const skHex = process.env.SENDER_SK;
if (!skHex) throw new Error("SENDER_SK is not set");
const senderSk = hexToBytes(skHex);

// receiver
const receiverNpub = process.env.RECEIVER_NPUB;
if (!receiverNpub) throw new Error("RECEIVER_NPUB is not set");
const receiverHex = nip19.decode(receiverNpub).data as string;

const sealed = createRumorDM(senderSk, receiverHex, "test bot");
const giftWrap = createGiftwrap(receiverHex, sealed);

//publish
const pool = new SimplePool();
const relays = process.env.RELAYS?.split(",");
if (!relays) throw new Error("RELAYS is not set");

await Promise.allSettled(pool.publish(relays, giftWrap));
pool.close(relays);

console.log("NIP17 DM Sent!");
