# Amazon Global Logistics – MONGODB

---
# 1. CREAZIONE DATABASE
Creazione del database tramite MongoDB shell (mongosh):

```js
use amazon_global_logistics
````

## Spiegazione

Questo comando crea (se non esiste) e seleziona il database `amazon_global_logistics`, che contiene tutte le collezioni del progetto.

---

# 2. CREAZIONE COLLEZIONI

Creazione delle collezioni principali del sistema:

```js
db.createCollection("assets")
db.createCollection("inventory")
db.createCollection("sellers")
db.createCollection("price_history")
db.createCollection("reviews")
```

## Spiegazione

Le collezioni rappresentano le entità principali:

* `assets` → prodotti fisici/digitali/bundle
* `inventory` → stock per venditore
* `sellers` → venditori della piattaforma
* `price_history` → storico prezzi prodotti
* `reviews` → recensioni utenti

---

# 3. SCHEMI E INSERIMENTO DATI

MongoDB non utilizza schemi rigidi, ma si definisce una struttura logica dei documenti.

---

# 3.1 SELLERS

## Schema logico

```js
{
  _id: String,
  name: String
}
```

## Inserimento dati

```js
db.sellers.insertMany([
  { _id: "S1", name: "TechStore EU" },
  { _id: "S2", name: "Global Electronics" },
  { _id: "S3", name: "Digital World" }
])
```

---

# 3.2 ASSETS (PRODOTTI)

## Schema logico

```js
{
  _id: String,
  name: String,
  type: String,
  basePrice: Number
}
```

## Inserimento dati

```js
db.assets.insertMany([
  { _id: "A1", name: "Gaming Monitor", type: "physical", basePrice: 300 },
  { _id: "A2", name: "Mechanical Keyboard", type: "physical", basePrice: 120 },
  { _id: "A3", name: "Office Suite License", type: "digital", basePrice: 80 },
  { _id: "A4", name: "Gaming Headset", type: "physical", basePrice: 150 },
  { _id: "A5", name: "Laptop Pro 15", type: "physical", basePrice: 1200 }
])
```

---

# 3.3 INVENTORY

## Schema logico

```js
{
  sellerId: String,
  assetId: String,
  quantity: Number
}
```

## Inserimento dati

```js
db.inventory.insertMany([
  { sellerId: "S1", assetId: "A1", quantity: 50 },
  { sellerId: "S1", assetId: "A2", quantity: 120 },
  { sellerId: "S1", assetId: "A3", quantity: 80 },

  { sellerId: "S2", assetId: "A1", quantity: 30 },
  { sellerId: "S2", assetId: "A4", quantity: 60 },

  { sellerId: "S3", assetId: "A5", quantity: 25 }
])
```

---

# 3.4 PRICE HISTORY

## Schema logico

```js
{
  assetId: String,
  prices: [
    {
      price: Number,
      date: Date
    }
  ]
}
```

## Inserimento dati

```js
db.price_history.insertMany([
  {
    assetId: "A1",
    prices: [
      { price: 280, date: new Date("2024-03-01") },
      { price: 310, date: new Date("2024-03-10") }
    ]
  },
  {
    assetId: "A2",
    prices: [
      { price: 100, date: new Date("2024-03-01") },
      { price: 130, date: new Date("2024-03-10") }
    ]
  }
])
```

---

# 3.5 REVIEWS

## Schema logico

```js
{
  assetId: String,
  userId: String,
  rating: Number
}
```

## Inserimento dati

```js
db.reviews.insertMany([
  { assetId: "A1", userId: "U1", rating: 5 },
  { assetId: "A1", userId: "U2", rating: 4 },
  { assetId: "A2", userId: "U3", rating: 5 },
  { assetId: "A3", userId: "U4", rating: 3 },
  { assetId: "A4", userId: "U5", rating: 4 }
])
```

---

# 4. QUERY DI TEST

---

## 4.1 Prodotti con stock per seller

```js
db.inventory.find(
  { sellerId: "S1" },
  { assetId: 1, quantity: 1, _id: 0 }
)
```

## Spiegazione

Restituisce tutti i prodotti in stock per un venditore specifico.

---

## 4.2 Prezzo medio storico di un prodotto

```js
db.price_history.aggregate([
  { $match: { assetId: "A1" } },
  { $unwind: "$prices" },
  {
    $group: {
      _id: "$assetId",
      avgPrice: { $avg: "$prices.price" }
    }
  }
])
```

## Spiegazione

Calcola il prezzo medio storico del prodotto.

---

## 4.3 Ultimo prezzo aggiornato (LOGICA CORE)

```js
db.price_history.aggregate([
  { $match: { assetId: "A1" } },
  { $unwind: "$prices" },
  { $sort: { "prices.date": -1 } },
  { $limit: 1 }
])
```

## Spiegazione

Restituisce l’ultimo prezzo inserito per un prodotto.

---

## 4.4 Valore totale inventario per seller

```js
db.inventory.aggregate([
  { $match: { sellerId: "S1" } },

  {
    $lookup: {
      from: "assets",
      localField: "assetId",
      foreignField: "_id",
      as: "asset"
    }
  },

  { $unwind: "$asset" },

  {
    $group: {
      _id: null,
      totalValue: {
        $sum: { $multiply: ["$quantity", "$asset.basePrice"] }
      }
    }
  }
])
```

## Spiegazione

Calcola il valore totale dello stock per un venditore.

---

## 4.5 Recensioni medie per prodotto

```js
db.reviews.aggregate([
  {
    $group: {
      _id: "$assetId",
      avgRating: { $avg: "$rating" }
    }
  }
])
```

## Spiegazione

Restituisce la valutazione media per ogni prodotto.

---

# 5. BACKEND NODE.JS (EXPRESS API)

Il backend è sviluppato in **Node.js con Express** e si occupa di:

- connessione a MongoDB
- gestione API REST
- calcolo stock e prezzi dinamici
- aggregazioni dati
- aggiornamento prezzi

---

## 5.1 AVVIO SERVER

```bash
node server.js
````

Output atteso:

```
MongoDB connected
Server running http://localhost:3000
```

---

## 5.2 STRUTTURA FILE

```
/amazon_project
│
├── server.js
├── index.html
├── package.json
└── /public (opzionale)
```

---

## 5.3 CONNESSIONE MONGODB

```js id="mongo_conn"
const client = new MongoClient("mongodb://admin:password@localhost:27017")

let db

async function start() {
  await client.connect()
  db = client.db("amazon_global_logistics")
  console.log("MongoDB connected")
}
start()
```

---

## 5.4 API PRINCIPALI

### SELLERS

```http
GET /api/sellers
```

---

### DASHBOARD SELLER

```http
GET /api/seller-view/:sellerId
```

---

### ASSETS CON STOCK

```http
GET /api/assets-with-stock
```

---

### RECENSIONI

```http
GET /api/reviews/:assetId
```

---

### AGGIORNAMENTO PREZZO

```http
POST /api/assets/:assetId/price
```

---

## 5.5 LOGICA PREZZO

Il prezzo viene calcolato così:

1. Se esiste `price_history` → usa **ultimo prezzo aggiornato**
2. Se non esiste → usa `basePrice`

---

## 5.6 SCREENSHOT INTERFACCIA

![Dashboard Amazon Clone](./images/dashboard.jpeg)

