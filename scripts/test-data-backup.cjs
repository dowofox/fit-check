const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const storageMemory = new Map();
let failNextMultiGet = false;
let failNextMultiSetAfterFirstEntry = false;
let nextMultiSetBarrier = null;

global.__DEV__ = false;

const asyncStorage = {
  async getItem(key) {
    return storageMemory.has(key) ? storageMemory.get(key) : null;
  },
  async setItem(key, value) {
    storageMemory.set(key, value);
  },
  async multiSet(entries) {
    const barrier = nextMultiSetBarrier;
    if (barrier) {
      nextMultiSetBarrier = null;
      barrier.markStarted();
      await barrier.waitForRelease;
    }

    if (failNextMultiSetAfterFirstEntry) {
      failNextMultiSetAfterFirstEntry = false;
      if (entries[0]) storageMemory.set(entries[0][0], entries[0][1]);
      throw new Error("mock partial backup restore failure");
    }

    entries.forEach(([key, value]) => storageMemory.set(key, value));
  },
  async multiRemove(keys) {
    keys.forEach((key) => storageMemory.delete(key));
  },
  async multiGet(keys) {
    if (failNextMultiGet) {
      failNextMultiGet = false;
      throw new Error("mock backup read failure");
    }

    return keys.map((key) => [
      key,
      storageMemory.has(key) ? storageMemory.get(key) : null,
    ]);
  },
};

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return { __esModule: true, default: asyncStorage };
  }

  return originalLoad.call(this, request, parent, isMain);
};

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;

  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(result.outputText, filename);
};

const {
  buildNaesBackupPayload,
  getNaesBackupSummary,
  materializeNaesBackupData,
  NAES_BACKUP_ASSET_PREFIX,
  parseNaesBackupJson,
} = require("../utils/dataBackup.ts");
const {
  getClosetItems,
  getClosetRecommendationIndex,
  getNaesBackupDataSnapshot,
  getOutfitRecommendationFeedbacks,
  getOutfitWearRecords,
  getRecommendationRevisionState,
  getSavedOutfits,
  getUserProfile,
  restoreNaesBackupDataSnapshot,
  saveClosetItem,
  updateClosetItem,
} = require("../utils/storage.ts");

test.beforeEach(() => {
  failNextMultiGet = false;
  failNextMultiSetAfterFirstEntry = false;
  nextMultiSetBarrier = null;
});

function pauseNextMultiSet() {
  let markStarted;
  let release;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const waitForRelease = new Promise((resolve) => {
    release = resolve;
  });

  nextMultiSetBarrier = { markStarted, waitForRelease };
  return { started, release };
}

function createSnapshot() {
  return {
    closetItems: [
      {
        id: "top-1",
        imageUri: "file:///closet/top.jpg",
        cleanImageUri: "file:///closet/top.png",
        category: "상의",
        detailCategory: "반팔 티셔츠",
        confirmedProduct: {
          brand: "TEST",
          productName: "테스트 반팔 티셔츠",
          productImageUrl: "file:///closet/product.jpg",
          confirmedAt: "2026-07-17T00:00:00.000Z",
        },
        createdAt: "2026-07-17T01:00:00.000Z",
      },
      {
        id: "bottom-1",
        imageUri: "file:///closet/top.jpg",
        category: "하의",
        detailCategory: "데님 팬츠",
        createdAt: "2026-07-17T01:01:00.000Z",
      },
      {
        id: "shoes-1",
        imageUri: "https://example.com/shoes.jpg",
        category: "신발",
        createdAt: "2026-07-17T01:02:00.000Z",
      },
    ],
    profile: { height: "175", topSize: "L" },
    savedOutfits: [
      {
        id: "outfit-1",
        itemIds: ["top-1", "bottom-1", "shoes-1"],
        score: 82,
        grade: "A",
        reasons: ["균형이 좋아요."],
        warnings: [],
        createdAt: "2026-07-17T02:00:00.000Z",
      },
    ],
    outfitFeedbacks: [
      {
        itemIds: ["shoes-1", "top-1", "bottom-1"],
        value: "like",
        updatedAt: "2026-07-17T03:00:00.000Z",
      },
    ],
    wearRecords: [
      {
        id: "wear-1",
        savedOutfitId: "outfit-1",
        itemIds: ["top-1", "bottom-1", "shoes-1"],
        wornAt: "2026-07-17T04:00:00.000Z",
        dateKey: "2026-07-17",
      },
    ],
  };
}

test("full backup embeds local images once and keeps remote images portable", async () => {
  const reads = [];
  const payload = await buildNaesBackupPayload(
    createSnapshot(),
    async (uri) => {
      reads.push(uri);
      return Buffer.from(uri).toString("base64");
    },
    "2026-07-17T05:00:00.000Z"
  );

  assert.deepEqual(reads, [
    "file:///closet/top.jpg",
    "file:///closet/top.png",
    "file:///closet/product.jpg",
  ]);
  assert.equal(payload.images.length, 3);
  assert.equal(payload.data.closetItems[0].imageUri, `${NAES_BACKUP_ASSET_PREFIX}image-1`);
  assert.equal(
    payload.data.closetItems[0].confirmedProduct.productImageUrl,
    `${NAES_BACKUP_ASSET_PREFIX}image-3`
  );
  assert.equal(payload.data.closetItems[1].imageUri, `${NAES_BACKUP_ASSET_PREFIX}image-1`);
  assert.equal(payload.data.closetItems[2].imageUri, "https://example.com/shoes.jpg");
  assert.deepEqual(getNaesBackupSummary(payload), {
    closetItemCount: 3,
    savedOutfitCount: 1,
    feedbackCount: 1,
    wearRecordCount: 1,
    imageCount: 3,
    hasProfile: true,
  });
});

test("photo-less manual closet items remain valid in backup files", async () => {
  const snapshot = createSnapshot();
  snapshot.closetItems = [
    {
      id: "manual-accessory",
      imageUri: "",
      category: "액세서리",
      detailCategory: "벨트",
      color: "블랙",
      createdAt: "2026-07-20T01:00:00.000Z",
    },
  ];

  const payload = await buildNaesBackupPayload(snapshot, async () => {
    throw new Error("manual items must not request an image read");
  });
  const parsedPayload = parseNaesBackupJson(JSON.stringify(payload));

  assert.equal(parsedPayload.data.closetItems.at(-1).imageUri, "");
  assert.equal(parsedPayload.images.length, 0);
});

test("restore writes embedded images and reconnects every closet image field", async () => {
  const payload = await buildNaesBackupPayload(createSnapshot(), async (uri) =>
    Buffer.from(uri).toString("base64")
  );
  const writes = [];
  const restored = await materializeNaesBackupData(payload, async (asset, index) => {
    writes.push(asset.id);
    return `file:///restored/image-${index + 1}.${asset.extension}`;
  });

  assert.deepEqual(writes, ["image-1", "image-2", "image-3"]);
  assert.equal(restored.closetItems[0].imageUri, "file:///restored/image-1.jpg");
  assert.equal(restored.closetItems[0].cleanImageUri, "file:///restored/image-2.png");
  assert.equal(
    restored.closetItems[0].confirmedProduct.productImageUrl,
    "file:///restored/image-3.jpg"
  );
  assert.equal(restored.closetItems[1].imageUri, "file:///restored/image-1.jpg");
  assert.equal(restored.closetItems[2].imageUri, "https://example.com/shoes.jpg");
});

test("full backup fails instead of silently omitting an unreadable local image", async () => {
  await assert.rejects(
    buildNaesBackupPayload(createSnapshot(), async (uri) => {
      if (uri.endsWith("top.png")) throw new Error("missing file");
      return "aW1hZ2U=";
    }),
    /이미지를 백업하지 못했어요/
  );
});

test("invalid backups fail before any image is written", async () => {
  const payload = await buildNaesBackupPayload(createSnapshot(), async () => "aW1hZ2U=");
  const invalidPayload = {
    ...payload,
    data: { ...payload.data, savedOutfits: [{ id: "broken" }] },
  };
  let writeCount = 0;

  await assert.rejects(
    materializeNaesBackupData(invalidPayload, async () => {
      writeCount += 1;
      return "file:///unexpected.jpg";
    }),
    /저장 코디 데이터 형식/
  );
  assert.equal(writeCount, 0);
});

test("backup parsing rejects unsupported versions and missing image assets", async () => {
  const payload = await buildNaesBackupPayload(createSnapshot(), async () => "aW1hZ2U=");

  assert.throws(
    () => parseNaesBackupJson(JSON.stringify({ ...payload, version: 999 })),
    /지원하지 않는 백업 버전/
  );
  assert.throws(
    () => parseNaesBackupJson(JSON.stringify({ ...payload, images: [] })),
    /필요한 옷 이미지가 누락/
  );
  assert.throws(
    () =>
      parseNaesBackupJson(
        JSON.stringify({
          ...payload,
          images: payload.images.map((image, index) =>
            index === 0 ? { ...image, base64: "not-base64" } : image
          ),
        })
      ),
    /백업 이미지 형식/
  );
});

test("restored source data replaces storage and rebuilds derived closet data", async () => {
  storageMemory.clear();
  storageMemory.set(
    "naes_home_recommendation_cache",
    JSON.stringify({ version: 2, initial: { key: "stale" } })
  );
  const snapshot = createSnapshot();

  await restoreNaesBackupDataSnapshot(snapshot);

  assert.deepEqual(await getClosetItems(), snapshot.closetItems);
  assert.deepEqual(await getUserProfile(), snapshot.profile);
  assert.deepEqual(await getSavedOutfits(), snapshot.savedOutfits);
  assert.equal((await getOutfitRecommendationFeedbacks()).length, 1);
  assert.equal((await getOutfitWearRecords()).length, 1);
  assert.ok(storageMemory.has("naes_closet_recommendation_index"));
  assert.equal(storageMemory.get("naes_home_recommendation_cache"), "");
  assert.deepEqual(await getRecommendationRevisionState(), {
    version: 1,
    closetRevision: 1,
    profileRevision: 1,
    savedOutfitRevision: 1,
    feedbackRevision: 1,
  });

  const exportedSnapshot = await getNaesBackupDataSnapshot();
  assert.equal(exportedSnapshot.closetItems.length, 3);
  assert.equal(exportedSnapshot.savedOutfits.length, 1);
});

test("partial backup restore writes are rolled back to the previous app data", async () => {
  storageMemory.clear();
  const previousSnapshot = createSnapshot();
  await restoreNaesBackupDataSnapshot(previousSnapshot);
  storageMemory.set(
    "naes_home_recommendation_cache",
    JSON.stringify({ version: 2, initial: { key: "previous-cache" } })
  );
  const previousStorage = new Map(storageMemory);
  const replacementSnapshot = {
    ...createSnapshot(),
    closetItems: [
      {
        id: "replacement-top",
        imageUri: "https://example.com/replacement.jpg",
        category: "상의",
        createdAt: "2026-07-20T00:00:00.000Z",
      },
    ],
    profile: { height: "180", topSize: "XL" },
  };

  failNextMultiSetAfterFirstEntry = true;

  await assert.rejects(
    restoreNaesBackupDataSnapshot(replacementSnapshot),
    /mock partial backup restore failure/
  );
  assert.deepEqual(storageMemory, previousStorage);
  assert.deepEqual(await getClosetItems(), previousSnapshot.closetItems);
  assert.deepEqual(await getUserProfile(), previousSnapshot.profile);
});

test("backup restore keeps only reference clothing that exists in the matching category", async () => {
  storageMemory.clear();
  const snapshot = createSnapshot();
  snapshot.profile = {
    ...snapshot.profile,
    referenceClothing: {
      topItemId: "bottom-1",
      bottomItemId: "bottom-1",
      outerItemId: "missing-outer",
      shoesItemId: "shoes-1",
    },
  };

  await restoreNaesBackupDataSnapshot(snapshot);

  assert.deepEqual((await getUserProfile()).referenceClothing, {
    bottomItemId: "bottom-1",
    shoesItemId: "shoes-1",
  });
});

test("backup snapshot fails instead of exporting empty data after a storage read error", async () => {
  await restoreNaesBackupDataSnapshot(createSnapshot());
  failNextMultiGet = true;

  await assert.rejects(
    getNaesBackupDataSnapshot(),
    /mock backup read failure/
  );
  assert.equal((await getClosetItems()).length, 3);
});

test("backup snapshot waits for an in-flight closet mutation", async () => {
  storageMemory.clear();
  const barrier = pauseNextMultiSet();
  const item = {
    id: "concurrent-top",
    imageUri: "https://example.com/concurrent-top.jpg",
    category: "상의",
    detailCategory: "반팔 티셔츠",
    createdAt: "2026-07-19T00:00:00.000Z",
  };
  const savePromise = saveClosetItem(item);

  await barrier.started;

  let snapshotSettled = false;
  const snapshotPromise = getNaesBackupDataSnapshot().then((snapshot) => {
    snapshotSettled = true;
    return snapshot;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(snapshotSettled, false);

  barrier.release();
  await savePromise;
  const snapshot = await snapshotPromise;

  assert.deepEqual(snapshot.closetItems.map((closetItem) => closetItem.id), [
    item.id,
  ]);
});

test("backup snapshot rejects a corrupted root value", async () => {
  storageMemory.clear();
  storageMemory.set("naes_closet", "{broken-json");

  await assert.rejects(getNaesBackupDataSnapshot(), SyntaxError);
});

test("backup snapshot rejects partially corrupted source arrays", async () => {
  const snapshot = createSnapshot();
  const invalidSources = [
    ["naes_closet", [...snapshot.closetItems, { id: "broken-item" }]],
    [
      "naes_saved_outfits",
      [...snapshot.savedOutfits, { id: "broken-outfit", itemIds: "not-an-array" }],
    ],
    [
      "naes_outfit_recommendation_feedback",
      [...snapshot.outfitFeedbacks, { itemIds: "not-an-array", value: "like" }],
    ],
    [
      "naes_outfit_wear_records",
      [...snapshot.wearRecords, { id: "broken-wear", itemIds: [] }],
    ],
  ];

  for (const [storageKey, invalidValue] of invalidSources) {
    storageMemory.clear();
    await restoreNaesBackupDataSnapshot(snapshot);
    storageMemory.set(storageKey, JSON.stringify(invalidValue));

    await assert.rejects(getNaesBackupDataSnapshot(), /invalid/);
  }
});

test("legacy closet and profile fields survive partial updates and version 1 backup restore", async () => {
  storageMemory.clear();
  const legacyItem = {
    id: "legacy-top",
    imageUri: "https://example.com/legacy-top.jpg",
    category: "상의",
    detailCategory: "긴팔 티셔츠",
    color: "그레이",
    style: "캐주얼",
    season: "봄/가을",
    size: "L",
    createdAt: "2024-01-02T03:04:05.000Z",
  };
  const legacyProfile = {
    height: "175",
    topSize: "L",
    bottomSize: "32",
    shoeSize: "270",
  };

  storageMemory.set("naes_closet", JSON.stringify([legacyItem]));
  storageMemory.set("naes_profile", JSON.stringify(legacyProfile));

  assert.deepEqual(await getClosetItems(), [legacyItem]);
  assert.deepEqual(await getUserProfile(), legacyProfile);

  await updateClosetItem(legacyItem.id, { recommendationPreference: "prefer" });
  const updatedItem = (await getClosetItems())[0];

  assert.equal(updatedItem.style, legacyItem.style);
  assert.equal(updatedItem.season, legacyItem.season);
  assert.equal(updatedItem.recommendationPreference, "prefer");
  assert.equal(updatedItem.seasons, undefined);
  assert.equal(updatedItem.styleTags, undefined);

  const payload = await buildNaesBackupPayload(
    await getNaesBackupDataSnapshot(),
    async () => "aW1hZ2U="
  );
  const parsedPayload = parseNaesBackupJson(JSON.stringify(payload));

  storageMemory.clear();
  await restoreNaesBackupDataSnapshot(parsedPayload.data);

  assert.deepEqual(await getClosetItems(), [updatedItem]);
  assert.deepEqual(await getUserProfile(), legacyProfile);
});

test("corrupted storage shapes are isolated without discarding valid records", async () => {
  storageMemory.clear();
  const validItem = createSnapshot().closetItems[0];
  const validOutfit = createSnapshot().savedOutfits[0];

  storageMemory.set(
    "naes_closet",
    JSON.stringify([
      validItem,
      null,
      { id: "missing-category", imageUri: "", createdAt: "2026-01-01" },
    ])
  );
  storageMemory.set("naes_profile", JSON.stringify(["프로필이 아닌 배열"]));
  storageMemory.set(
    "naes_saved_outfits",
    JSON.stringify([validOutfit, { id: "broken-outfit", itemIds: "not-an-array" }])
  );

  assert.deepEqual(await getClosetItems(), [validItem]);
  assert.equal(await getUserProfile(), null);
  assert.deepEqual(await getSavedOutfits(), [validOutfit]);

  const recommendationIndex = await getClosetRecommendationIndex();
  assert.equal(recommendationIndex.index.recommendationItems.length, 1);

  storageMemory.set("naes_closet", JSON.stringify({ items: [validItem] }));
  storageMemory.set("naes_saved_outfits", JSON.stringify({ outfits: [validOutfit] }));

  assert.deepEqual(await getClosetItems(), []);
  assert.deepEqual(await getSavedOutfits(), []);
});
