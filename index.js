const express = require('express');
const path=require('path');
const bodyParser=require('body-parser');
const cors=require('cors');
const passport=require('passport')
const mongoose=require('mongoose');
const app = express();

const port=3000;
const http=require('http');

const mongo = require('mongodb').MongoClient;
const io = require('socket.io').listen(3000).sockets;

app.use(cors());
app.use(function(req, res, next) {
    res.render('index');
});   

app.get('/',(req, res) => res.send("hello world"));

mongo.connect('mongodb://localhost:27017/myChatApp',function(err,client){
    if(err ) throw err;
    console.log('Connected to mongodb'); 

    io.on('connection',function(socket){
        //console.log("Socket is on");
        var db = client.db('myChatApp');
        chat = db.collection('chats');
        user=db.collection('users');
        online_users=db.collection('online_users');
        

        socket.on('register',function(data){
            user.insert(data,function(){
                var data={reg:'Done'};
                //console.log(data.reg);
                socket.emit('done',[data]);
            });
        });

        //Login
        socket.on('login',function(data){
            //console.log(data);
            user.find(data).toArray(function(err,res){
                if(err) {
                    socket.emit('loggedin',err);
                    //console.log(err);
                    //throw err;
                }else{
                    //console.log(res);
                    socket.emit('loggedin',res);
                }

            });
        });

        //get all chats from database
        chat.find().limit(100).sort({_id:1}).toArray(function(err,res){
            if(err) throw err;
            socket.emit('output',res);
        });

        //Handle input events
        socket.on('input',function(data){
            let message=data.message;
            //Check for name and messages
            if(message==''){
                //sendStatus('Enter a message');
            } else{
                //Insert in database
                var data={message:message};
                chat.insert(data,function(){
                    io.emit('output',[data]);
                });
            }
        });

        socket.on('end', function (){
            io.close();
        });

    });
});