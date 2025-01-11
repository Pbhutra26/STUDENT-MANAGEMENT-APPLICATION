const express = require('express');
const cors = require('cors');
const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('./student-management-d265a-firebase-adminsdk-nnp8t-3cd3af8924.json');

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all origins

// Initialize Firebase Admin SDK
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
});
const db = firebaseAdmin.firestore();

app.post("/students", async (req, res) => {
  try {
    const { name, age, phone, learningLevel, metadata, imageUrl } = req.body;

    const studentsCollection = db.collection("student");

    const snapshot = await studentsCollection.orderBy("rollNumber", "desc").limit(1).get();
    let rollNumber = 1;
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0];
      rollNumber = lastDoc.data().rollNumber + 1;
    }

    await studentsCollection.doc(rollNumber.toString()).set({
      rollNumber,
      name,
      age,
      phone,
      learningLevel,
      metadata,
      imageUrl,  // Save image URL
    });

    res.status(201).json({
      message: "Student created successfully.",
      rollNumber,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/students/:rollNumber", async (req, res) => {
  try {
    const rollNumber = parseInt(req.params.rollNumber);
    const { name, age, phone, learningLevel, metadata, imageUrl } = req.body;

    const studentDoc = db.collection("student").doc(rollNumber.toString());

    const doc = await studentDoc.get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Student not found." });
    }

    await studentDoc.update({
      name,
      age,
      phone,
      learningLevel,
      metadata,
      imageUrl,  // Update image URL
    });

    res.status(200).json({
      message: "Student updated successfully.",
      rollNumber,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/students/:rollNumber", async (req, res) => {
  try {
    const rollNumber = parseInt(req.params.rollNumber);
    const doc = await db.collection("student").doc(rollNumber.toString()).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Student not found." });
    }

    res.status(200).json(doc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/students", async (req, res) => {
    try {
      const snapshot = await db.collection("student").get();
  
      // Convert the snapshot to an array of student objects
      const students = snapshot.docs.map(doc => ({ 
        ...doc.data() // Spread the document data
      }));
  
      // Sort students by roll number
      students.sort((a, b) => a.rollNumber - b.rollNumber);
  
      res.status(200).json(students);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Helper function to parse date in dd-mm-yy format
function parseDate(dateStr) {
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

app.get("/sundays", async (req, res) => {
  try {
    const snapshot = await db.collection("sundays").get();
    
    // Convert the snapshot to an array of sunday objects
    const sundays = snapshot.docs.map(doc => ({
      date: doc.id, // Use the document ID as date
      ...doc.data() // Spread the document data
    }));

    // Sort sundays chronologically
    sundays.sort((a, b) => parseDate(b.date) - parseDate(a.date));

    res.status(200).json(sundays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/sundays/:date", async (req, res) => {
  try {
    const dateKey = req.params.date;
    const doc = await db.collection("sundays").doc(dateKey).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Date not found." });
    }

    res.status(200).json(doc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/attendance/:numberofsundays/:rollnumber", async (req, res) => {
  try {
    const { numberofsundays, rollnumber } = req.params;
    const sundaysCollection = db.collection("sundays");
    const snapshot = await sundaysCollection.get();

    // Convert the snapshot to an array of sunday objects
    const sundays = snapshot.docs.map(doc => ({
      date: doc.id, // Use the document ID as date
      ...doc.data() // Spread the document data
    }));

    // Sort sundays chronologically and limit to the specified number of sundays
    sundays.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    const limitedSundays = sundays.slice(0, parseInt(numberofsundays));

    const attendance = limitedSundays.map(sunday => sunday.numbers.includes(rollnumber));

    res.status(200).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/attendance/add/:date/:rollnumber', async (req, res) => {
  try {
    const { date, rollnumber } = req.params;

    const sundaysCollection = db.collection('sundays');
    const docRef = sundaysCollection.doc(date);

    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({
        numbers: firebaseAdmin.firestore.FieldValue.arrayUnion(rollnumber)
      });
    } else {
      await docRef.set({
        date, // Include date as a field
        numbers: [rollnumber]
      });
    }

    res.status(200).send('Roll number added successfully');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/store-numbers', async (req, res) => {
  try {
    const { date, numbers } = req.body;
    if (!date || !Array.isArray(numbers)) {
      return res.status(400).send('Invalid input');
    }

    const sundaysCollection = db.collection('sundays');
    const docRef = sundaysCollection.doc(date);

    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({
        date, // Include date as a field
        numbers: firebaseAdmin.firestore.FieldValue.arrayUnion(...numbers)
      });
    } else {
      await docRef.set({
        date, // Include date as a field
        numbers: numbers.map(Number)
      });
    }

    res.status(200).send('Numbers stored successfully');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/attendance/remove/:today/:rollNumber', async (req, res) => {
  try {
    const { today, rollNumber } = req.params;
    const sundaysCollection = db.collection('sundays');
    const docRef = sundaysCollection.doc(today);

    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Attendance record not found');
    }

    await docRef.update({
      numbers: firebaseAdmin.firestore.FieldValue.arrayRemove(parseInt(rollNumber))
    });

    res.status(200).send(`Attendance record for roll number ${rollNumber} on ${today} removed successfully`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
