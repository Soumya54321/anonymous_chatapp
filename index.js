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

var google = require("googleapis");
const googleConfig = {
    clientId: '539711683053-7c4fl9d7a4eak3ep9aj50oajsau9da9k.apps.googleusercontent.com', // e.g. asdfghjkljhgfdsghjk.apps.googleusercontent.com
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, // e.g. _ASDFA%DFASDFASDFASD#FAD-
    redirect: process.env.GOOGLE_REDIRECT_URL, // this must match your google api settings
};

const defaultScope = [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email',
];

function createConnection() {
    return new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirect
    );
}

function getConnectionUrl(auth) {
    return auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: defaultScope
    });
}

function getGooglePlusApi(auth) {
    return google.plus({ version: 'v1', auth });
}

function urlGoogle() {
    const auth = createConnection();
    const url = getConnectionUrl(auth);
    return url;
}

function getGoogleAccountFromCode(code) {
    const data = await auth.getToken(code);
    const tokens = data.tokens;
    const auth = createConnection();
    auth.setCredentials(tokens);
    const plus = getGooglePlusApi(auth);
    const me = await plus.people.get({ userId: 'me' });
    const userGoogleId = me.data.id;
    const userGoogleEmail = me.data.emails && me.data.emails.length && me.data.emails[0].value;
    return {
      id: userGoogleId,
      email: userGoogleEmail,
      tokens: tokens,
    };
}


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
            var num=data.number;
            num='+91'+num;
            console.log(num);
            user.find({number:data.number}).toArray(function(err,res){
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

        socket.on('registration_cancel',function(data){
            console.log(data.req_id);
            nexmo.verify.control({
                request_id: data.req_id,
                cmd: 'cancel'
            }, (err, result) => {
                console.log(err ? err : result)
            });
        });

        socket.on('google_regstration',function(){

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