from flask_sqlalchemy import SQLAlchemy

def db_init(app):
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    global db
    db = SQLAlchemy(app)
    
    global User
    class User(db.Model):
        user_id = db.Column(db.String(8), primary_key=True)
        username = db.Column(db.String(80), nullable=False)
        last_login = db.Column(db.DateTime, nullable=False)
    
    with app.app_context():
        db.create_all()
