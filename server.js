import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { authRouter, router } from "./routes.js"
import { asyncHandler, errorHandler } from "./middleware/error.middleware.js"
import { configDotenv } from "dotenv"
import { Pool } from "pg"
import { authenticateUser } from "./middleware/auth.middleware.js"

configDotenv()

const app = express()


const allowedOrigins=["http://localhost:5173","https://clinic-plus-xi.vercel.app"]

app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  }))
app.use(cookieParser())
app.use(express.json())


app.use("/api/auth",authRouter)
app.use("/api",asyncHandler(authenticateUser),router)

app.use(errorHandler)

export const pool=new Pool({
    connectionString:process.env.DATABASE_URI
})

const PORT=process.env.PORT||2000

app.listen(PORT,()=>console.log(`Server Started on port ${PORT}`))