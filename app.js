//jshint esversion:6
require('dotenv').config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

// custom functions

const shuffle = (array) => {
    var currentIndex = array.length, temporaryValue, randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

// // // // // // // // // // // // // // // // //

// const sha256 = require("sha256");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
// const encrypt = require("mongoose-encryption");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(session({
    secret: "Our little secret!",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false });
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: [String]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});

const User = mongoose.model("user", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
        done(null, user.id);
    });
    
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
        done(err, user);
        });
    });

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
    },
    function(accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", (req, res) => {
    res.render("home");
})

app.get("/auth/google", 
    passport.authenticate("google", {scope: ["profile"]})
);

app.get("/auth/google/secrets", 
    passport.authenticate("google", {failureRedirect: "/login"}),
    (req, res) => {
        // Successful Authentication, redirects to secret page
        res.redirect("/secrets");
    }
);

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
});

app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/secrets", (req, res) => {
    // if(req.isAuthenticated()){
    //     res.render("secrets");
    // } else {
    //     res.redirect("/login");
    // }
    User.find({secret: {$ne: null}}, (err, foundUsers) => {
        if(err){
            console.log(err);
            res.send(err);
        } else {
            console.log(foundUsers);
            var allSecrets = [];
            foundUsers.forEach((user) => {
                allSecrets.push.apply(allSecrets, user.secret);
            });
            console.log(allSecrets);
            shuffle(allSecrets);
            if(foundUsers){
                res.render("secrets", {allSecrets: allSecrets});
            } else {
                res.render("secrets", {allSecrets: allSecrets});
            }
        }
    })
});

app.get("/submit", (req, res) => {
    if(req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/register", (req, res) => {

    User.register({username: req.body.username}, req.body.password, (err, user) => {
        if(err){
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    });

    // const reqData = req.body;
    // bcrypt.hash(reqData.password, saltRounds, (err, hash) => {
    //     if(err){
    //         res.send("Error occured");
    //     } else {
    //         const newUser = new User({
    //             email: reqData.username,
    //             password: hash
    //         });
    //         newUser.save((err) => {
    //             if(err){
    //                 console.log(err);
    //                 res.send(err);
    //             } else {
    //                 console.log("new user created!!!");
    //                 res.render("secrets");
    //             }
    //         });
    //     }
    // });
});

app.post("/login", (req, res) => {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if(err){
            console.log(err);
            res.send(err);
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })

    // const reqData = req.body;
    // const username = reqData.username;
    // const password = reqData.password;
    // User.findOne({email:username}, (err, foundUser) => {
    //     if(err){
    //         res.send(err);
    //     } else if(foundUser){
    //         bcrypt.compare(password, foundUser.password, (err, result) => {
    //             if(result){
    //                 console.log("logged in successfully!!!");
    //                 res.render("secrets");
    //             }
    //             else{
    //                 res.send("Incorrect password try again!" + hash + " : " + foundUser.password);
    //             }
    //         });
    //     } else {
    //         res.send("user not registered")
    //     }
    // });
});

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;
    console.log(req.user);
    User.findById(req.user.id, (err, foundUser) => {
        if(err) {
            console.log(err);
            res.send(err);
        } else {
            if(foundUser) {
                foundUser.secret.push(submittedSecret);
                foundUser.save((err) => {
                    console.log("successfully added secret");
                    res.redirect("/secrets");
                });
            } else {
                console.log("Error in finding user(No such user found)");
                res.send("Error in finding user(No such user found)");
            }
        }
    })
})

app.listen(3000, () => {
    console.log("server is running on port 3000");
})