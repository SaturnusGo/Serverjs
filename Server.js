const express = require('express');
const bodyParser = require('body-parser');
const { Expo } = require('expo-server-sdk');
const db = require('./db'); // Импортируем модуль для работы с базой данных

const app = express();
const port = 3000;

app.use(bodyParser.json());

const expo = new Expo();

app.post('/register', async (req, res) => {
  const { name, email, password, token } = req.body;

  if (!name || !email || !password || !token) {
    res.status(400).json({ message: 'Invalid registration data' });
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/saveToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('Save Token Error:', errorData.message);
    }
  } catch (error) {
    console.log('Save Token Error:', error.message);
  }

  const existingUser = await db.getUserByEmail(email);

  if (existingUser) {
    const messages = [{
      to: token,
      sound: 'default',
      title: 'Email already registered',
      body: 'Tap to recover your account.',
      data: { email },
    }];

    try {
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      const receiptIds = [];

      for (const ticket of tickets) {
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
      }

      const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      const receiptResponses = [];

      for (const chunk of receiptIdChunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

        for (const receiptId in receipts) {
          const receipt = receipts[receiptId];

          if (receipt.status === 'ok') {
            continue;
          } else if (receipt.status === 'error') {
            console.error(`There was an error sending a notification: ${receipt.message}`);
          }
        }

        receiptResponses.push(receipts);
      }

      res.status(400).json({ message: 'User with the same email already exists' });
    } catch (error) {
      console.error('Error sending push notifications:', error);
      res.status(500).json({ message: 'Error sending push notifications' });
    }

    return;
  }

  try {
    await db.addUser(name, email, password);
    res.status(200).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ message: 'Error adding user' });
  }
});

app.post('/saveToken', (req, res) => {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ message: 'Invalid token data' });
    return;
  }

  // Сохраняем токен на сервере или выполняем другие действия
  // ...

  res.status(200).json({ message: 'Token saved successfully' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Invalid login data' });
    return;
  }

  try {
    const user = await db.getUserByEmailAndPassword(email, password);

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Error getting user' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
