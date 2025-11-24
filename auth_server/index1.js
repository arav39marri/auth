const express = require('express');
const session = require('express-session');
const passport = require('passport');
require('./oauth');

const app = express();

function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
}

app.use(session({ secret: 'cats', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  res.send('<a href="/auth/google">Authenticate with Google</a>');
});

app.get('/auth/google',
  passport.authenticate('google', { scope: [ 'email', 'profile' ] }
));

app.get( '/auth/google/callback',
  passport.authenticate( 'google', {
    successRedirect: '/protected',
    failureRedirect: '/auth/google/failure'
  })
);

app.get('/protected', isLoggedIn, (req, res) => {
  res.send(`Hello ${req.user.displayName}`);
});

app.get('/logout', (req, res) => {
    if (req.isAuthenticated()) { // Check if user is logged in
        req.logout((err) => {
            if (err) { return next(err); }
            req.session.destroy(() => {
                res.clearCookie('connect.sid'); // Clears the session cookie
                res.redirect('/'); // Redirect to home after logout
            });
        });
    } else {
        res.redirect('/'); 
    }
 });
 
app.get('/auth/google/failure', (req, res) => {
  res.send('Failed to authenticate..');
});

app.listen(3005, () => console.log('listening on port: 3005'));