import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import Joi from 'joi'
import dayjs from 'dayjs'
dotenv.config()

const mongoClient = new MongoClient(process.env.MONGO_URI)
let db;

await mongoClient.connect()
db = mongoClient.db("batePapoUol")

const app = express()
app.use(cors())
app.use(express.json())

app.get("/participants", async (req, res) => {
    try {
        const showParticipants = await db.collection("participants").find().toArray()
        return res.send(showParticipants)
    } catch (err) {
        console.log(err)
        return res.sendStatus(500)
    }
})

app.post("/participants", async (req, res) => {

    const { name } = req.body

    function validateUser(name) {
        const JoiSchema = Joi.object({
            name: Joi.string()
                .min(3)
                .max(30)
                .required()
        });

        return JoiSchema.validate({ name })
    }

    const response = validateUser(name)

    try {

        const findUser = await db.collection("participants").findOne({ name })

        if (findUser) {
            return res.sendStatus(409)
        }

        if (response.error) {
            console.log(response.error.message)
            return res.sendStatus(422)
        }

        await db.collection("participants").insertOne({
            name,
            lastStatus: Date.now()
        })

        await db.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "Entra na sala...",
            type: "status",
            time: dayjs().format('HH:mm:ss')
        })

        return res.sendStatus(201)

    } catch (err) {
        return res.sendStatus(500)
    }
})

app.get("/messages", async (req, res) => {
    const { limit } = req.query
    const { user } = req.headers

    try {
        const showMessages = await db.collection("messages").find().toArray()
        const filterMessages = showMessages.filter(mens => mens.from === user || mens.to === user || mens.to === "Todos")

        if (Number(limit).length !== 0) {
            return res.send(filterMessages.slice(Number(limit * -1)))
        }

        return res.send(filterMessages)
    } catch (err) {
        console.log(err)
        return res.sendStatus(500)
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const { user: from } = req.headers

    function validateMessage(from, to, text, type) {
        const JoiSchema = Joi.object({
            from: Joi.string()
                .min(3)
                .max(30)
                .required(),
            to: Joi.string()
                .min(3)
                .max(30)
                .required(),
            text: Joi.string()
                .min(3)
                .required(),
            type: Joi.string()
                .valid("message", "private_message")
                .required()
        });

        return JoiSchema.validate({ from, to, text, type })
    }

    const response = validateMessage(from, to, text, type)

    try {

        const findFrom = await db.collection("participants").findOne({ name: from })

        if (findFrom === null) {
            return res.sendStatus(422)
        }

        if (response.error) {
            console.log(response.error.message)
            return res.sendStatus(422)
        }

        await db.collection("messages").insertOne({
            from,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        })

        return res.sendStatus(201)

    } catch (err) {
        return res.sendStatus(500)
    }

})

app.post("/status", async (req, res) => {
    const { user } = req.headers
    const findFrom = await db.collection("participants").findOne({ name: user })

    try {
        if (findFrom === null) {
            return res.sendStatus(404)
        } await db.collection("participants").updateOne({name: user}), {
            $set: {lastStatus: Date.now()}
        }

        return res.sendStatus(200)
    } catch (err) {
        return res.sendStatus(500)
    }
})

setInterval(async () => {
    const listParticipants = await db.collection("participants").find().toArray()
    const filterParticipants = listParticipants.filter(part => {
        const soma = Date.now() - part.lastStatus;
        if(soma >= 10000){
            db.collection("messages").insertOne({
                from: part.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format('HH:mm:ss')
            })
            db.collection("participants").deleteOne({name: part.name})
        } else {
            console.log("Usuário removido!")
        }
    })
}, 15000)

app.listen(5000)