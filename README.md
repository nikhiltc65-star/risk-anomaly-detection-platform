# RiskWatch: Real-Time Risk & Anomaly Detection Platform

A lightweight dashboard for monitoring transactions, events, risk scores, and unusual activity patterns. Events are published to **RabbitMQ**, processed by a Node.js consumer, scored using simple rule-based anomaly checks, and streamed to the browser in near real time.

## Features

- **Live monitoring dashboard:** event totals, active alerts, high-risk events, and average risk score.
- **RabbitMQ event queue:** events are published to the durable `risk.events` queue and consumed by the backend.
- **Rule-based anomaly detection:** scores events using transaction amount, unusual location, late-night activity, and repeated activity from the same user within 60 seconds.
- **Live updates:** Server-Sent Events (SSE) update the dashboard when an event is processed.
- **Failure recovery:** the server retries RabbitMQ connections every three seconds, queued messages are persistent, and messages are acknowledged after processing.
- **Dead-letter queue:** messages that fail validation are routed to `risk.events.dead` for inspection.
- **Filters and event simulator:** search by event details, filter by severity, submit a custom event, or generate a sample event.
- **Responsive interface:** HTML, CSS, and vanilla JavaScript, with no frontend framework required.

## Tech stack

- HTML5, CSS,  JavaScript
- RabbitMQ and 
- Docker Compose for running RabbitMQ locally
- Server-Sent Events (SSE) for live dashboard updates

## Run locally

You need **Node.js 18 or newer** and **Docker Desktop** (or Docker Engine with the Compose plugin).

1. Open a terminal in this project folder.
2. Start RabbitMQ:

3. Install the Node.js dependencies:

   ```bash
   npm install
   ```

4. Start the application:

   ```bash
   npm start
   ```

5. Open **http://localhost:3000** in your browser.

The application retries its RabbitMQ connection automatically if the broker is still starting or becomes temporarily unavailable. Keep the terminal running while you use the dashboard.

### RabbitMQ management console

- URL: http://localhost:15672
- Username: `guest`
- Password: `guest`

The management console lets you inspect the `risk.events` and `risk.events.dead` queues. These default credentials are intended for local development only, not a public deployment.

## How the risk score works

The project uses transparent demo rules instead of a machine-learning model:

| Rule | Score added |
|---|---:|
| Transaction amount is ₹50,000 or more | +45 |
| Transaction amount is ₹20,000 to ₹49,999.99 | +25 |
| Location is `Unknown`, `New Country`, or `Overseas` | +25 |
| Event occurs between midnight and 4:59 AM (server local time) | +15 |
| Same user has another event within 60 seconds | +30 |

The score is capped at 100.

- **Low:** 0–39
- **Medium:** 40–69
- **High:** 70–100

An event becomes an alert at a score of 40 or higher. These rules are examples for demonstrating the workflow; they are not a production fraud model.

## Event workflow

1. A user submits an event through the dashboard.
2. The Express API validates the fields and publishes a persistent message to RabbitMQ.
3. The RabbitMQ consumer receives the message and applies the risk rules.
4. The backend records the result and acknowledges the message.
5. The dashboard receives an SSE update and refreshes the event stream, metrics, and alerts.
6. Failed-to-validate messages are rejected and routed to the dead-letter queue. If RabbitMQ disconnects, the backend retries the connection automatically.

## Project structure

```text
real-time-risk-anomaly-detection-platform/
├── public/
│   ├── index.html       # HTML dashboard structure
│   ├── css/
│   │   └── styles.css   # Dashboard styles and responsive layout
│   └── js/
│       └── app.js       # Browser logic, forms, filters, and live updates
├── server.js            # REST API, RabbitMQ producer/consumer, risk rules, SSE
├── package.json         # Node.js scripts and dependencies
├── docker-compose.yml   # Local RabbitMQ broker
├── .env.example         # Example environment settings
├── .gitignore
└── README.md
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check API and RabbitMQ connection status |
| `GET` | `/api/dashboard` | Get recent events, metrics, and broker status |
| `GET` | `/api/stream` | Receive live dashboard updates through SSE |
| `POST` | `/api/events` | Validate and enqueue a new event |

Example request to `POST /api/events`:

```json
{
  "amount": 56000,
  "userId": "user-104",
  "merchant": "Urban Market",
  "location": "Unknown",
  "eventType": "Purchase"
}
```

## Important demo limitations

- Processed event history (the 200 most recent events), session metrics, and user activity windows are stored in memory and reset when the Node.js server restarts. The RabbitMQ queues are durable, but the dashboard results are not stored in a database.
- Detection uses hand-written rules, not a trained machine-learning model.
- Run this project as a Node.js application with RabbitMQ. **GitHub Pages alone cannot run the backend or RabbitMQ broker.** GitHub is used to host the source code, while the app runs locally or on infrastructure that supports Node.js and RabbitMQ.
- The included RabbitMQ `guest` credentials are for local development only.

## Future improvements

- Persist processed events in PostgreSQL or MySQL.
- Add authentication and role-based access.
- Add configurable thresholds and alert acknowledgements.
- Add unit tests, structured logs, and deployment secrets.
- Replace demo rules with a model trained and evaluated on suitable data.
