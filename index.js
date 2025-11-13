// index.js — Express + MongoDB server

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = 5000;

// ====== Middleware ======
app.use(cors());
app.use(express.json());

// ====== MongoDB Connection URI ======
const uri =
  "mongodb+srv://EventTracker:huTjrRb3RV31PVn3@cluster0.dqh1dvb.mongodb.net/?appName=Cluster0";

// ====== Create MongoDB Client ======
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ====== Connect to MongoDB and define routes ======
async function run() {
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");

    const db = client.db("socialDevelopmentEventsDB");
    const eventsCollection = db.collection("events");
    const joinedCollection = db.collection("joinedEvents");

    // ====== Basic Route ======
    app.get("/", (req, res) => {
      res.send("🚀 Social Development Events Server is running!");
    });

    // ====== POST: Create a new event ======
    app.post("/events", async (req, res) => {
      try {
        const newEvent = req.body;

        if (
          !newEvent.title ||
          !newEvent.description ||
          !newEvent.eventType ||
          !newEvent.thumbnail ||
          !newEvent.location ||
          !newEvent.date ||
          !newEvent.createdBy
        ) {
          return res
            .status(400)
            .send({ success: false, message: "All fields are required." });
        }

        newEvent.createdAt = new Date();

        const result = await eventsCollection.insertOne(newEvent);
        res.status(201).send({
          success: true,
          message: "Event created successfully!",
          data: result,
        });
      } catch (err) {
        console.error("❌ Error creating event:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to create event." });
      }
    });

    // ====== GET: Fetch all events (or filter by creator) ======
    app.get("/events", async (req, res) => {
      try {
        const { createdBy } = req.query;
        let query = {};
        if (createdBy) query.createdBy = createdBy;

        const events = await eventsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(events);
      } catch (err) {
        console.error("❌ Error fetching events:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch events." });
      }
    });

    // ====== GET: Fetch single event by ID ======
    app.get("/events/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid event ID" });
        }

        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

        if (!event) {
          return res
            .status(404)
            .send({ success: false, message: "Event not found" });
        }

        res.send(event);
      } catch (err) {
        console.error("❌ Error fetching single event:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch event." });
      }
    });

    // ====== PUT: Update an event ======
    app.put("/events/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid event ID" });
      }

      try {
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) {
          return res
            .status(404)
            .send({ success: false, message: "Event not found" });
        }

        const result = await eventsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        res.send({
          success: true,
          message: "Event updated successfully",
          data: result,
        });
      } catch (err) {
        console.error("❌ Error updating event:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to update event." });
      }
    });

    // ====== DELETE: Remove an event ======
    app.delete("/events/:id", async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid event ID" });
      }

      try {
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) {
          return res
            .status(404)
            .send({ success: false, message: "Event not found" });
        }

        await eventsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send({ success: true, message: "Event deleted successfully" });
      } catch (err) {
        console.error("❌ Error deleting event:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete event." });
      }
    });

    // ====== POST: Join an event ======
    app.post("/events/join", async (req, res) => {
      try {
        const { eventId, userEmail } = req.body;

        if (!eventId || !userEmail) {
          return res
            .status(400)
            .send({ success: false, message: "Missing data." });
        }

        // Prevent duplicate joins
        const existing = await joinedCollection.findOne({ eventId, userEmail });
        if (existing) {
          return res
            .status(400)
            .send({ success: false, message: "Already joined." });
        }

        const result = await joinedCollection.insertOne({
          eventId,
          userEmail,
          joinedAt: new Date(),
        });

        res.status(201).send({
          success: true,
          message: "Joined event successfully!",
          data: result,
        });
      } catch (err) {
        console.error("❌ Error joining event:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to join event." });
      }
    });

    // ====== GET: Fetch all joined events for a user ======
    app.get("/events/joined/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const joinedEvents = await joinedCollection
          .find({ userEmail: email })
          .toArray();

        // Fetch actual event details using event IDs
        const eventIds = joinedEvents.map((j) => new ObjectId(j.eventId));
        const events = await eventsCollection
          .find({ _id: { $in: eventIds } })
          .toArray();

        res.send({ success: true, events });
      } catch (err) {
        console.error("❌ Error fetching joined events:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch joined events." });
      }
    });

    // ====== DELETE: Leave an event ======
    app.delete("/events/leave", async (req, res) => {
      try {
        const { eventId, userEmail } = req.body;
        if (!eventId || !userEmail)
          return res
            .status(400)
            .send({ success: false, message: "Missing data." });

        const result = await joinedCollection.deleteOne({ eventId, userEmail });

        if (result.deletedCount === 0)
          return res
            .status(404)
            .send({ success: false, message: "Join record not found." });

        res.send({ success: true, message: "Left event successfully!" });
      } catch (err) {
        console.error("❌ Error leaving event:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to leave event." });
      }
    });

    // ====== GET: Check if user already joined an event ======
    app.get("/events/join/check", async (req, res) => {
      try {
        const { eventId, userEmail } = req.query;

        if (!eventId || !userEmail) {
          return res
            .status(400)
            .send({ success: false, message: "Missing query parameters." });
        }

        const existing = await joinedCollection.findOne({ eventId, userEmail });

        res.send({
          success: true,
          joined: !!existing, // true if already joined, false otherwise
        });
      } catch (err) {
        console.error("❌ Error checking join status:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to check join status." });
      }
    });

    console.log("🌐 All routes are ready!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

run().catch(console.dir);

// ====== Run Server ======
app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});
