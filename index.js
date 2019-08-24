const express = require('express');
const exphbs=require('express-handlebars');
const bodyperser=require('body-parser');
const cors=require('cors');
const app = express();

const mongo = require('mongodb').MongoClient;
const io = require('socket.io').listen(3000).sockets;

const Nexmo = require('nexmo');

const nexmo = new Nexmo({
  apiKey: 'e306b438',
  apiSecret: 'ePdmS3tfZU5OnPJY',
});

var firebase = require("firebase/app");

// Add the Firebase products that you want to use
require("firebase/auth");
require("firebase/firestore");

//src="https://www.gstatic.com/firebasejs/6.4.1/firebase-app.js";

/*var firebaseConfig = {
    apiKey: "AIzaSyAhUE_0oW9AxGo83YzQbEuNcNMC_mw9WtA",
    authDomain: "mychatapp-2e817.firebaseapp.com",
    databaseURL: "https://mychatapp-2e817.firebaseio.com",
    projectId: "mychatapp-2e817",
    storageBucket: "",
    messagingSenderId: "975276390613",
    appId: "1:975276390613:web:21596e68ad7c8c89"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);*/



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
        loggedin_user=db.collection('loggedin_users');
        online_users=db.collection('online_users');
        pairs=db.collection('pairs');
        waiting=db.collection('waiting');

        socket.on('register',function(data){
            num=data.number;
            num='+91'+num;
            console.log(num);
            user.find({num}).toArray(function(err,res){
                console.log(res);
                if(!res[0]){
                    nexmo.verify.request({
                        number: num,
                        brand: 'Quoke',
                        code_length: '6',
                      }, (err, result) => {
                        if (err) throw err;
                        data={req_id:result.request_id};

                        socket.emit('otp_sent',data);
                        console.log(data);
                      });


                    //console.log("Done");
                    //user.insert(data,function(){
                    //    var data={reg:'Done'};
                        //console.log(data.reg);
                    //    socket.emit('done',[data]);
                    //});
                }else{
                    socket.emit('same_user',[data]);
                }
            });
        }); 

        socket.on('otp_verification',function(data){
            code=data.otp;
            
            nexmo.verify.check({
                request_id: data.req_id,
                code: code
            }, (err, result) => {
                if (err) throw err;
                else{
                    data={
                        name:data.name,
                        username:data.username,
                        number:data.number,
                        password:data.password
                    }
                    console.log(result);
                    user.insert(data,function(){
                        var data={reg:'Done'};
                        console.log(data.reg);
                        socket.emit('done',[data]);
                    });
                }
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
                    var count=0;
                    online_users.count().then(function(result){
                        this.count=result;
                    });
                    loggedin_user.insert(data);
                    online_users.insert(data,function(){
                       this.count=count+1;
                        //console.log(count);
                        data={online_count:this.count};
                        //console.log(data);
                        socket.emit('online',[data]);
                    });
                    socket.emit('loggedin',res);
                }
            });
        });
        
        //Setting chat id 
        socket.on('chat_id_req',function(data){
            loggedin_user.find().limit(100).toArray(function(err,res){
                if(err) throw err;
                for(i=0;i<=res.length;i++){
                    if(data.username==res[i].username){
                        res.splice(i,1);
                        break;
                    }
                }
                waiting.insert(data);
                var intid=setInterval(function(user){
                    waiting.find().limit(100).toArray(function(err,res){
                        if(err) throw err;
                        
                        if(res.length>1){
                            for(i=0;i<res.length;i++){
                                if(data.username==res[i].username){
                                    res.splice(i,1);
                                    break;
                                }
                            }
                            //console.log(res);
                            var friend = res[Math.floor(Math.random() * res.length)];
                            //console.log(friend.socket_id);
                            //console.log(data.socket_id);
                            number=Math.floor((Math.random()*5000000000000+6)+Math.random()*19849463464194946+1);
                            data1={pair_id:number,online:res.length,friend:friend.socket_id};
                            data2={pair_id:number,online:res.length,friend:data.socket_id};
                            io.to(friend.socket_id).emit('pair_id',[data2]);
                            io.to(data.socket_id).emit('pair_id',[data1]);

                            data3={pair_id:number,user1:friend.socket_id,user2:data.socket_id};
                            clearInterval(intid);    
                            pairs.insert(data3);
                            waiting.remove(data);
                            waiting.remove(friend);
                        }
                        else{
                            data2={status:0};
                            socket.emit('no_one',[data2]);
                        }
                    });
                },500);
            });
        });

        socket.on('logout',function(data){
            loggedin_user.remove(data);
            online_users.remove(data);
        });

        //get all chats from database
        /*chat.find().limit(100).sort({_id:1}).toArray(function(err,res){
            if(err) throw err;
            socket.emit('output',res);
        });*/

        //Handle input events
        socket.on('input_chat',function(data){
            let message=data.message;
            let sender=data.sender;
            let reciever=data.reciever;
            let pair_id=data.pair_id;
            //Check for name and messages
            if(message==''){
                //sendStatus('Enter a message');
            } else{
                //Insert in database
                //var data={message:message,sender:sender,pair:pair_id};
                chat.insert(data,function(){
                    io.to(sender).emit('output',[data]);
                    io.to(reciever).emit('output',[data]);
                });
            }
        });

        socket.on('end', function (){
            io.close();
        });

    });
});