const express = require("express")
const { MongoClient } = require("mongodb")
const cors = require("cors")
const path = require("path")

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

const client = new MongoClient("mongodb://admin:password@localhost:27017")
let db

async function start() {
  await client.connect()
  db = client.db("amazon_global_logistics")
  console.log("MongoDB connected")
}
start()

function getLatestPrice(historyDoc) {
  if (!historyDoc || !Array.isArray(historyDoc.prices) || historyDoc.prices.length === 0) {
    return null
  }

  const sorted = [...historyDoc.prices].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  )

  return Number(sorted[0].price) || null
}

function resolveAssetPrice(asset, historyDoc) {
  const latest = getLatestPrice(historyDoc)

  if (latest !== null) return latest
  if (asset && asset.basePrice !== undefined && asset.basePrice !== null) return Number(asset.basePrice)
  return 0
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/api/sellers", async (req, res) => {
  const data = await db.collection("sellers").find().toArray()
  res.json(data)
})

app.get("/api/reviews/:assetId", async (req, res) => {
  const data = await db.collection("reviews")
    .find({ assetId: req.params.assetId })
    .toArray()

  res.json(data)
})

app.get("/api/seller-view/:sellerId", async (req, res) => {
  const sellerId = req.params.sellerId

  const inventory = await db.collection("inventory")
    .find({ sellerId })
    .toArray()

  const assets = await db.collection("assets").find().toArray()
  const histories = await db.collection("price_history").find().toArray()

  const assetMap = new Map(assets.map(a => [a._id, a]))
  const historyMap = new Map(histories.map(h => [h.assetId, h]))

  let totalUnits = 0
  let totalValue = 0

  const items = inventory.map(item => {
    const asset = assetMap.get(item.assetId)
    const history = historyMap.get(item.assetId)
    const price = resolveAssetPrice(asset, history)

    totalUnits += Number(item.quantity) || 0
    totalValue += price * (Number(item.quantity) || 0)

    return {
      assetId: item.assetId,
      name: asset?.name || "Unknown",
      type: asset?.type || "unknown",
      price,
      stock: Number(item.quantity) || 0
    }
  })

  res.json({
    items,
    totalProducts: items.length,
    totalUnits,
    totalValue
  })
})

app.get("/api/assets-with-stock", async (req, res) => {
  const assets = await db.collection("assets").find().toArray()
  const inventory = await db.collection("inventory").find().toArray()
  const histories = await db.collection("price_history").find().toArray()

  const stockMap = new Map()
  for (const item of inventory) {
    const current = stockMap.get(item.assetId) || 0
    stockMap.set(item.assetId, current + (Number(item.quantity) || 0))
  }

  const historyMap = new Map(histories.map(h => [h.assetId, h]))

  const result = assets.map(asset => {
    const history = historyMap.get(asset._id)
    const price = resolveAssetPrice(asset, history)

    return {
      ...asset,
      price,
      stock: stockMap.get(asset._id) || 0
    }
  })

  res.json(result)
})

app.post("/api/assets/:assetId/price", async (req, res) => {
  try {
    const assetId = req.params.assetId
    const { price } = req.body

    if (price === undefined || price === null || Number.isNaN(Number(price))) {
      return res.status(400).json({ error: "Price not valid" })
    }

    const newPrice = Number(price)
    const now = new Date()

    const asset = await db.collection("assets").findOne({ _id: assetId })
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" })
    }

    await db.collection("price_history").updateOne(
      { assetId },
      {
        $push: {
          prices: {
            price: newPrice,
            date: now
          }
        }
      },
      { upsert: true }
    )

    await db.collection("assets").updateOne(
      { _id: assetId },
      {
        $set: {
          currentPrice: newPrice,
          priceUpdatedAt: now
        }
      }
    )

    res.json({
      ok: true,
      assetId,
      currentPrice: newPrice,
      updatedAt: now
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

app.listen(3000, () => {
  console.log("Server running http://localhost:3000")
})