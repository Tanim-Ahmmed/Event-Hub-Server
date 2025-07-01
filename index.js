require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// Middleware

const allowedOrigins = [
  "http://localhost:5173", 
  "https://event-hub-client-seven.vercel.app", 
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, 
  })
);

app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fgufh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("eventhubDB").collection("users");
    const eventCollection = client.db("eventhubDB").collection("events");

    // event APIs

    app.post("/events", async (req, res) => {
      const newEvent = req.body;
      const result = await eventCollection.insertOne(newEvent);
      res.send(result);
    });

    app.post("/events/:id/join", async (req, res) => {
      const eventId = req.params.id;
      const userEmail = req.body.email;

      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      try {
        const result = await eventCollection.updateOne(
          { _id: new ObjectId(eventId), attendeeCount: { $ne: userEmail } },
          { $addToSet: { attendeeCount: userEmail } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(400)
            .json({ message: "User already joined the event" });
        }

        res.status(200).json({ message: "Successfully joined the event" });
      } catch (error) {
        console.error("Error joining event:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/events", async (req, res) => {
      const { search } = req.query;
      const query = {};

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      const result = await eventCollection
        .find(query)
        .sort({ dateTime: 1 })
        .toArray();
      res.send(result);
    });

    app.put("/events/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: updatedData.title,
          name: updatedData.name,
          email: updatedData.email,
          location: updatedData.location,
          description: updatedData.description,
          dateTime: new Date(updatedData.dateTime),
          attendeeCount: updatedData.attendeeCount || [],
        },
      };

      const result = await eventCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.delete("/events/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await eventCollection.deleteOne(query);
      res.send(result);
    });

    // User Registration and Login

    app.post("/register", async (req, res) => {
      const { name, email, password, photo } = req.body;

      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = {
        name,
        email,
        password: hashedPassword,
        photo,
      };

      await usersCollection.insertOne(newUser);
      res.status(201).json({ user: { name, email, photo } });
    });

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Email not found" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Incorrect password" });
      }
      res.status(200).json({
        user: { name: user.name, email: user.email, photo: user.photo },
      });
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Event Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
