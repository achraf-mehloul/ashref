from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import json
from collections import defaultdict
import re
import paypalrestsdk
import stripe

app = Flask(__name__)
app.secret_key = '6327077b4334f16473a169e8d49acfff213b7ee31aabcd0b519b50e408fb6ee6'  
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm'}

app.config['PAYPAL_MODE'] = 'sandbox'  
app.config['PAYPAL_CLIENT_ID'] = 'your_paypal_client_id'
app.config['PAYPAL_CLIENT_SECRET'] = 'your_paypal_secret'
app.config['STRIPE_PUBLIC_KEY'] = 'your_stripe_public_key'
app.config['STRIPE_SECRET_KEY'] = 'your_stripe_secret_key'  

paypalrestsdk.configure({
    "mode": app.config['PAYPAL_MODE'],
    "client_id": app.config['PAYPAL_CLIENT_ID'],
    "client_secret": app.config['PAYPAL_CLIENT_SECRET']
})

stripe.api_key = app.config['STRIPE_SECRET_KEY']

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

PRODUCTS_FILE = 'products.json'
ORDERS_FILE = 'orders.json'
SETTINGS_FILE = 'settings.json'
USERS_FILE = 'users.json'
PAYMENTS_FILE = 'payments.json'

def load_data():
    data = {
        'users': {},
        'products': [],
        'orders': [],
        'settings': {
            'site_title': 'My E-Shop',
            'site_description': 'Best online shopping experience',
            'welcome_title': 'Welcome to our store',
            'welcome_subtitle': 'Best products at best prices',
            'welcome_message': 'Welcome to our e-shop',
            'whatsapp_number': '213782675199',
            'logo': 'images/logo.png',
            'background_video': 'videos/bg.mp4',
            'products_per_page': 8  # إعداد جديد لعدد المنتجات لكل صفحة
        },
        'payments': []
    }
    
    try:
        if not os.path.exists(PRODUCTS_FILE):
            with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f)
        
        if not os.path.exists(ORDERS_FILE):
            with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f)
                
        if os.path.exists(PRODUCTS_FILE):
            with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                data['products'] = json.load(f)
        
        if os.path.exists(ORDERS_FILE):
            with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
                data['orders'] = json.load(f)
                for order in data['orders']:
                    order['id'] = int(order['id']) if isinstance(order['id'], str) else order['id']
        
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                data['settings'] = json.load(f)
        
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data['users'] = json.load(f)
        
        if os.path.exists(PAYMENTS_FILE):
            with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
                data['payments'] = json.load(f)
    
    except Exception as e:
        print(f"Error loading data: {e}")
    
    return data
def save_data(data_type, data):
    try:
        filename = {
            'products': PRODUCTS_FILE,
            'orders': ORDERS_FILE,
            'settings': SETTINGS_FILE,
            'users': USERS_FILE,
            'payments': PAYMENTS_FILE
        }.get(data_type)
        
        if not filename:
            raise ValueError(f"Unknown data type: {data_type}")

        if not os.path.exists(filename):
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump([] if data_type in ['products', 'orders', 'payments'] else {}, f)

        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"Data saved successfully to {filename}")
        return True
    except Exception as e:
        print(f"Error saving {data_type}: {e}")
        return False

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def get_chart_data():
    data = load_data()
    orders = data['orders']
    sales_data = {}
    orders_data = {}
    now = datetime.now()
    
    for i in range(5, -1, -1):
        month = (now - timedelta(days=30*i)).strftime('%b')
        sales_data[month] = 0
        orders_data[month] = 0
    
    product_sales = defaultdict(int)
    
    for order in orders:
        order_date = datetime.strptime(order['date'], '%Y-%m-%d %H:%M:%S')
        month = order_date.strftime('%b')
        
        if month in sales_data:
            sales_data[month] += order['total']
            orders_data[month] += 1
        
        for item in order.get('order_items', []):
            product_sales[item['name']] += item['quantity']
    
    top_products = sorted(product_sales.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        'sales': {
            'labels': list(sales_data.keys()),
            'data': list(sales_data.values())
        },
        'orders': {
            'labels': list(orders_data.keys()),
            'data': list(orders_data.values())
        },
        'products': {
            'labels': [p[0] for p in top_products],
            'data': [p[1] for p in top_products]
        }
    }

def validate_phone(phone):
    pattern = r'^(\+213|0)(5|6|7)[0-9]{8}$'
    return re.match(pattern, phone) is not None
    
def get_active_products():
    data = load_data()
    return [p for p in data['products'] if p.get('is_active', True)]

@app.route('/api/products')
def api_products():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 8, type=int)
    
    active_products = get_active_products()
    total_products = len(active_products)
    start = (page - 1) * per_page
    end = start + per_page
    
    paginated_products = active_products[start:end]
    
    return jsonify({
        'products': paginated_products,
        'total': total_products,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_products + per_page - 1) // per_page
    })
@app.route('/')
def home():
    data = load_data()
    
    for product in data['products']:
        if 'date_added' not in product:
            product['date_added'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            save_data('products', data['products'])
    
    latest_products = sorted(data['products'], 
                           key=lambda x: x.get('date_added', ''), 
                           reverse=True)[:8]
    
    return render_template('index.html', 
                         products=latest_products,
                         settings=data['settings'],
                         paypal_client_id=app.config['PAYPAL_CLIENT_ID'],
                         stripe_public_key=app.config['STRIPE_PUBLIC_KEY'],
                         wilayas=[
                             'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi',
                             'Batna', 'Bejaia', 'Biskra', 'Bechar',
                             'Blida', 'Bouira', 'Tamanrasset', 'Tebessa',
                             'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Algiers',
                             'Djelfa', 'Jijel', 'Setif', 'Saida',
                             'Skikda', 'Sidi Bel Abbes', 'Annaba', 'Guelma',
                             'Constantine', 'Medea', 'Mostaganem', 'M\'Sila',
                             'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
                             'Illizi', 'Bordj Bou Arreridj', 'Boumerdes', 'El Tarf',
                             'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
                             'Souk Ahras', 'Tipaza', 'Mila', 'Ain Defla',
                             'Naama', 'Ain Temouchent', 'Ghardaia', 'Relizane'
                         ])

@app.route('/place_order', methods=['POST'])
def place_order():
    if request.method == 'POST':
        try:
            data = load_data()
            orders = data['orders']
            
            order_data = request.get_json()
            
            if not order_data or 'products' not in order_data or not order_data['products']:
                return jsonify({'success': False, 'message': 'No products in cart'})
            
            required_fields = ['firstName', 'lastName', 'email', 'wilaya', 'address', 'phone']
            missing_fields = [field for field in required_fields if not order_data.get(field)]
            
            if missing_fields:
                return jsonify({
                    'success': False,
                    'message': f'Required fields: {", ".join(missing_fields)}'
                })
            
            if not validate_phone(order_data['phone']):
                return jsonify({
                    'success': False,
                    'message': 'Invalid phone number. Please enter a valid Algerian phone number.'
                })
            
            if '@' not in order_data['email'] or '.' not in order_data['email']:
                return jsonify({
                    'success': False,
                    'message': 'Invalid email address'
                })
            
            order_items = []
            total = 0
            for item in order_data['products']:
                product = next((p for p in data['products'] if str(p['id']) == str(item['id'])), None)
                if product:
                    order_items.append({
                        'id': product['id'],
                        'name': product['name'],
                        'price': product['price'],
                        'quantity': item['quantity'],
                        'image': product.get('image', '')
                    })
                    total += product['price'] * item['quantity']
            
            if not order_items:
                return jsonify({'success': False, 'message': 'No valid products found'})
            new_id = max([order['id'] for order in orders], default=0) + 1
            
            new_order = {
                'id': new_id,
                'customer_name': f"{order_data['firstName']} {order_data['lastName']}",
                'email': order_data['email'],
                'wilaya': order_data['wilaya'],
                'address': order_data['address'],
                'phone': order_data['phone'],
                'total': total,
                'status': 'pending',
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'order_items': order_items,
                'payment_method': order_data.get('payment_method', 'cash'),
                'payment_status': order_data.get('payment_status', 'pending')
            }
            
            orders.append(new_order)
            
            try:
                data['orders'] = orders  
                save_data('orders', orders)
                
                return jsonify({
                    'success': True,
                    'message': 'Your order has been received! We will contact you soon.',
                    'order_id': new_order['id']
                })
            except Exception as e:
                print(f"Error saving order: {str(e)}")
                return jsonify({
                    'success': False,
                    'message': 'Failed to save your order. Please try again.'
                })
            
        except Exception as e:
            print(f"Error processing order: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Error processing order: {str(e)}'
            })
@app.route('/create_paypal_payment', methods=['POST'])
def create_paypal_payment():
    try:
        data = request.get_json()
        amount = data.get('amount')
        currency = data.get('currency', 'USD')
        
        payment = paypalrestsdk.Payment({
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "transactions": [{
                "amount": {
                    "total": str(amount),
                    "currency": currency
                },
                "description": "Payment for order"
            }],
            "redirect_urls": {
                "return_url": url_for('execute_paypal_payment', _external=True),
                "cancel_url": url_for('payment_cancelled', _external=True)
            }
        })
        
        if payment.create():
            return jsonify({'success': True, 'paymentID': payment.id})
        else:
            return jsonify({'success': False, 'message': payment.error})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/execute_paypal_payment', methods=['GET'])
def execute_paypal_payment():
    payment_id = request.args.get('paymentId')
    payer_id = request.args.get('PayerID')
    
    try:
        payment = paypalrestsdk.Payment.find(payment_id)
        
        if payment.execute({"payer_id": payer_id}):
            payment_data = {
                'payment_id': payment_id,
                'payer_id': payer_id,
                'amount': payment.transactions[0].amount.total,
                'currency': payment.transactions[0].amount.currency,
                'status': 'completed',
                'method': 'paypal',
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            data = load_data()
            data.setdefault('payments', [])
            data['payments'].append(payment_data)
            save_data('payments', data['payments'])
            
            return redirect(url_for('payment_success'))
        else:
            return redirect(url_for('payment_failed'))
    except Exception as e:
        print(f"PayPal payment execution error: {str(e)}")
        return redirect(url_for('payment_failed'))

@app.route('/create_stripe_payment', methods=['POST'])
def create_stripe_payment():
    try:
        data = request.get_json()
        amount = int(float(data['amount']) * 100)  
        currency = data.get('currency', 'usd')
        token = data['token']
        
        charge = stripe.Charge.create(
            amount=amount,
            currency=currency,
            source=token,
            description="Payment for order"
        )
        
        payment_data = {
            'payment_id': charge.id,
            'amount': charge.amount / 100,
            'currency': charge.currency,
            'status': charge.status,
            'method': 'stripe',
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        data = load_data()
        data.setdefault('payments', [])
        data['payments'].append(payment_data)
        save_data('payments', data['payments'])
        
        return jsonify({'success': True, 'message': 'Payment successful'})
    except stripe.error.StripeError as e:
        return jsonify({'success': False, 'message': str(e)})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/process_ccp_payment', methods=['POST'])
def process_ccp_payment():
    try:
        data = request.get_json()
        amount = data.get('amount')
        reference = data.get('reference')
        
        if not reference:
            return jsonify({'success': False, 'message': 'Reference number is required'})
        
        payment_data = {
            'payment_id': f"ccp_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'amount': amount,
            'currency': 'DZD',
            'status': 'completed',
            'method': 'ccp',
            'reference': reference,
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        data = load_data()
        data.setdefault('payments', [])
        data['payments'].append(payment_data)
        save_data('payments', data['payments'])
        
        return jsonify({'success': True, 'message': 'CCP payment processed successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/process_baridimob_payment', methods=['POST'])
def process_baridimob_payment():
    try:
        data = request.get_json()
        amount = data.get('amount')
        phone = data.get('phone')
        
        if not phone or not validate_phone(phone):
            return jsonify({'success': False, 'message': 'Valid phone number is required'})
        
        
        payment_data = {
            'payment_id': f"baridimob_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'amount': amount,
            'currency': 'DZD',
            'status': 'completed',
            'method': 'baridimob',
            'phone': phone,
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        data = load_data()
        data.setdefault('payments', [])
        data['payments'].append(payment_data)
        save_data('payments', data['payments'])
        
        return jsonify({'success': True, 'message': 'Baridi Mob payment initiated successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/payment_success')
def payment_success():
    return render_template('payment_success.html')

@app.route('/payment_failed')
def payment_failed():
    return render_template('payment_failed.html')

@app.route('/payment_cancelled')
def payment_cancelled():
    return render_template('payment_cancelled.html')

@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    data = load_data()
    users = data['users']
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username in users and users[username]['password'] == password:
            session['logged_in'] = True
            session['user'] = users[username]
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('admin/login.html')

@app.route('/admin/dashboard')
def admin_dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))

    
    data = load_data()
    print(f"Debug - Orders loaded: {data['orders']}")

    data = load_data()
    chart_data = get_chart_data()

    data = load_data()
    print(f"Loaded orders: {data['orders']}")
    
    total_sales = sum(order.get('total', 0) for order in data['orders'])
    total_orders = len(data['orders'])
    total_products = len(data['products'])
    total_users = len(data['users'])
    
    return render_template('admin/dashboard.html',
                         user=session.get('user'),
                         products=data['products'],
                         orders=data['orders'],
                         settings=data['settings'],
                         users=data['users'],
                         total_sales=total_sales,
                         total_orders=total_orders,
                         total_products=total_products,
                         total_users=total_users,
                         current_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                         chart_data=chart_data)

@app.route('/admin/delete_all_products', methods=['POST'])
def delete_all_products():
    if not session.get('logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    data = load_data()
    data['products'] = []
    save_data('products', data['products'])
    
    return jsonify({'success': True, 'message': 'All products deleted successfully'})

@app.route('/admin/delete_all_orders', methods=['POST'])
def delete_all_orders():
    if not session.get('logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    data = load_data()
    data['orders'] = []
    save_data('orders', data['orders'])
    
    return jsonify({'success': True, 'message': 'All orders deleted successfully'})

@app.route('/admin/delete_order/<int:order_id>', methods=['POST'])
def delete_order(order_id):
    if not session.get('logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    data = load_data()
    data['orders'] = [o for o in data['orders'] if o['id'] != order_id]
    save_data('orders', data['orders'])
    
    return jsonify({'success': True, 'message': 'Order deleted successfully'})

@app.route('/admin/add_product', methods=['POST'])
def add_product():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))
    
    if request.method == 'POST':
        try:
            data = load_data()
            products = data['products']
            
            name = request.form.get('name')
            price = request.form.get('price')
            description = request.form.get('description')
            features = request.form.get('features', '')
            background_image = request.files.get('background_image')
            
            if not name or not price or not description:
                flash('All fields are required', 'error')
                return redirect(url_for('admin_dashboard'))
            
            try:
                price = float(price)
            except ValueError:
                flash('Price must be a number', 'error')
                return redirect(url_for('admin_dashboard'))
            
            image_file = request.files.get('image')
            image_path = None
            
            if image_file and image_file.filename:
                if allowed_file(image_file.filename):
                    filename = secure_filename(image_file.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    image_file.save(upload_path)
                    image_path = os.path.join('uploads', filename).replace('\\', '/')
                else:
                    flash('Image file type not allowed', 'error')
                    return redirect(url_for('admin_dashboard'))
            
            video_file = request.files.get('video')
            video_path = None
            
            if video_file and video_file.filename:
                if allowed_file(video_file.filename):
                    filename = secure_filename(video_file.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    video_file.save(upload_path)
                    video_path = os.path.join('uploads', filename).replace('\\', '/')
                else:
                    flash('Video file type not allowed', 'error')
                    return redirect(url_for('admin_dashboard'))
            
            bg_image_path = None
            if background_image and background_image.filename:
                if allowed_file(background_image.filename):
                    filename = secure_filename(background_image.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    background_image.save(upload_path)
                    bg_image_path = os.path.join('uploads', filename).replace('\\', '/')
                else:
                    flash('Background image file type not allowed', 'error')
                    return redirect(url_for('admin_dashboard'))
            
            new_id = str(max(int(p['id']) for p in products) + 1) if products else "1"
            
            new_product = {
                'id': new_id,
                'name': name,
                'price': price,
                'description': description,
                'features': features,
                'image': image_path if image_path else 'images/default-product.jpg',
                'video': video_path if video_path else '',
                'background_image': bg_image_path if bg_image_path else '',
                'date_added': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),  
                'is_active': True  
}
            
            products.append(new_product)
            save_data('products', products)
            
            flash('Product added successfully', 'success')
            return redirect(url_for('admin_dashboard'))
        
        except Exception as e:
            flash(f'Error adding product: {str(e)}', 'error')
            return redirect(url_for('admin_dashboard'))

@app.route('/admin/edit_product/<int:product_id>', methods=['POST'])
def edit_product(product_id):
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))
    
    data = load_data()
    products = data['products']
    product = next((p for p in products if str(p['id']) == str(product_id)), None)
    
    if not product:
        flash('Product not found', 'error')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        try:
            product['name'] = request.form.get('name')
            product['price'] = float(request.form.get('price'))
            product['description'] = request.form.get('description')
            product['features'] = request.form.get('features', '')
            
            image_file = request.files.get('image')
            if image_file and image_file.filename:
                if allowed_file(image_file.filename):
                    filename = secure_filename(image_file.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    image_file.save(upload_path)
                    product['image'] = os.path.join('uploads', filename).replace('\\', '/')
            
            video_file = request.files.get('video')
            if video_file and video_file.filename:
                if allowed_file(video_file.filename):
                    filename = secure_filename(video_file.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    video_file.save(upload_path)
                    product['video'] = os.path.join('uploads', filename).replace('\\', '/')
            
            background_image = request.files.get('background_image')
            if background_image and background_image.filename:
                if allowed_file(background_image.filename):
                    filename = secure_filename(background_image.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    background_image.save(upload_path)
                    product['background_image'] = os.path.join('uploads', filename).replace('\\', '/')
            
            save_data('products', products)
            flash('Product updated successfully', 'success')
            return redirect(url_for('admin_dashboard'))
        
        except Exception as e:
            flash(f'Error updating product: {str(e)}', 'error')
            return redirect(url_for('admin_dashboard'))
    
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/delete_product/<int:product_id>', methods=['POST'])
def delete_product(product_id):
    if not session.get('logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    data = load_data()
    data['products'] = [p for p in data['products'] if str(p['id']) != str(product_id)]
    save_data('products', data['products'])
    
    return jsonify({'success': True, 'message': 'Product deleted successfully'})

@app.route('/admin/update_order_status/<int:order_id>', methods=['POST'])
def update_order_status(order_id):
    if not session.get('logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    data = load_data()
    order = next((o for o in data['orders'] if o['id'] == order_id), None)
    if order:
        new_status = request.form.get('status')
        if new_status in ['pending', 'processing', 'completed', 'cancelled']:
            order['status'] = new_status
            save_data('orders', data['orders'])
            return jsonify({'success': True, 'message': 'Order status updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Invalid order status'})
    else:
        return jsonify({'success': False, 'message': 'Order not found'})

@app.route('/admin/settings', methods=['GET', 'POST'])
def admin_settings():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))
    
    data = load_data()
    
    if request.method == 'POST':
        try:
            settings = data['settings']
            
            settings['site_title'] = request.form.get('site_title')
            settings['site_description'] = request.form.get('site_description')
            settings['welcome_title'] = request.form.get('welcome_title')
            settings['welcome_subtitle'] = request.form.get('welcome_subtitle')
            settings['welcome_message'] = request.form.get('welcome_message')
            settings['whatsapp_number'] = request.form.get('whatsapp_number')
            
            logo_file = request.files.get('logo')
            if logo_file and logo_file.filename:
                if allowed_file(logo_file.filename):
                    filename = secure_filename(logo_file.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    logo_file.save(upload_path)
                    settings['logo'] = os.path.join('uploads', filename).replace('\\', '/')
            
            video_file = request.files.get('background_video')
            if video_file and video_file.filename:
                if allowed_file(video_file.filename):
                    filename = secure_filename(video_file.filename)
                    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    video_file.save(upload_path)
                    settings['background_video'] = os.path.join('uploads', filename).replace('\\', '/')
            
            save_data('settings', settings)
            flash('Settings saved successfully', 'success')
            return redirect(url_for('admin_settings'))
        
        except Exception as e:
            flash(f'Error saving settings: {str(e)}', 'error')
            return redirect(url_for('admin_settings'))
    
    return render_template('admin/settings.html', settings=data['settings'])
@app.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login'))

if __name__ == '__main__':
    if not os.path.exists(PRODUCTS_FILE):
        with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)

    if not os.path.exists(ORDERS_FILE):
        with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    if not os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'site_title': 'My E-Shop',
                'site_description': 'Best online shopping experience',
                'welcome_title': 'Welcome to our store',
                'welcome_subtitle': 'Best products at best prices',
                'welcome_message': 'Welcome to our e-shop',
                'whatsapp_number': '213782675199',
                'logo': 'images/logo.png',
                'background_video': 'videos/bg.mp4',
                'products_per_page': 8
            }, f, ensure_ascii=False, indent=2)


    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'admin': {
                    'password': 'admin123',
                    'name': 'Admin User',
                    'role': 'admin',
                    'email': 'admin@example.com',
                    'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
            }, f, ensure_ascii=False, indent=2)

    if not os.path.exists(PAYMENTS_FILE):
        with open(PAYMENTS_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=True)
