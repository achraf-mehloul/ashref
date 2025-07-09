document.addEventListener('DOMContentLoaded', function() {
    // Extract products from the template
    const products = Array.from(document.querySelectorAll('.product-card')).map(card => {
        return {
            id: card.getAttribute('data-product-id'),
            name: card.querySelector('.product-name').textContent,
            description: card.querySelector('.product-description').textContent,
            price: parseFloat(card.querySelector('.product-price').textContent),
            image: card.querySelector('.product-image').src,
            video: card.querySelector('.product-video') ? card.querySelector('.product-video source').src : null,
            features: Array.from(card.querySelectorAll('.product-features li')).map(li => li.textContent).join(',')
        };
    });

    // DOM Elements
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const cartBtn = document.getElementById('cartBtn');
    const cartModal = document.getElementById('cartModal');
    const closeCart = document.getElementById('closeCart');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const purchaseModal = document.getElementById('purchaseModal');
    const closeModal = document.getElementById('closeModal');
    const checkoutForm = document.getElementById('checkoutForm');
    const productModal = document.getElementById('productModal');
    const closeProductModal = document.getElementById('closeProductModal');
    const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');
    const continueShoppingBtn = document.getElementById('continueShoppingBtn');
    const tryAgainBtn = document.getElementById('tryAgainBtn');
    const discoverBtn = document.getElementById('discoverBtn');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');

    // Initialize cart
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let selectedPaymentMethod = null;
    let selectedPaymentOption = null;
    let currentOrderData = null;
    let paymentProcessing = false;

    const stripe = Stripe('{{ stripe_public_key }}');
    const elements = stripe.elements();
    let cardElement;

    // Theme Toggle
    themeToggle.addEventListener('click', function() {
        body.classList.toggle('light-mode');
        updateThemeIcon();
    });

    function updateThemeIcon() {
        const icon = themeToggle.querySelector('i');
        if (body.classList.contains('light-mode')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // Discover Button
    discoverBtn.addEventListener('click', function() {
        document.querySelector('.products-section').scrollIntoView({ behavior: 'smooth' });
    });

    // Product Cards
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.add-to-cart-btn')) {
                const productId = this.getAttribute('data-product-id');
                openProductModal(productId);
            }
        });
    });

    // Add to Cart Buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const productId = this.getAttribute('data-product-id');
            addToCart(productId);
        });
    });

    // Modal Add to Cart Button
    modalAddToCartBtn.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        addToCart(productId);
        closeProductModal.click();
    });

    // Cart Button
    cartBtn.addEventListener('click', function() {
        cartModal.style.display = 'flex';
        renderCartItems();
    });

    // Close Cart
    closeCart.addEventListener('click', function() {
        cartModal.style.display = 'none';
    });

    // Checkout Button
    checkoutBtn.addEventListener('click', function() {
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }
        purchaseModal.style.display = 'flex';
        cartModal.style.display = 'none';
    });

    // Close Modal
    closeModal.addEventListener('click', function() {
        purchaseModal.style.display = 'none';
    });

    // Close Product Modal
    closeProductModal.addEventListener('click', function() {
        productModal.style.display = 'none';
    });

    // Continue Shopping Button
    continueShoppingBtn.addEventListener('click', function() {
        document.getElementById('paymentSuccessModal').style.display = 'none';
        location.reload();
    });

    // Try Again Button
    tryAgainBtn.addEventListener('click', function() {
        document.getElementById('paymentFailedModal').style.display = 'none';
        purchaseModal.style.display = 'flex';
    });

    // Payment Options
    document.querySelectorAll('.payment-option[data-method]').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.payment-option[data-method]').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
            selectedPaymentMethod = this.getAttribute('data-method');
            
            if (selectedPaymentMethod === 'online') {
                document.getElementById('onlinePaymentOptions').style.display = 'block';
            } else {
                document.getElementById('onlinePaymentOptions').style.display = 'none';
            }
        });
    });

    // Online Payment Options
    document.querySelectorAll('.payment-option[data-payment]').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.payment-option[data-payment]').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
            selectedPaymentOption = this.getAttribute('data-payment');
        });
    });

    // Checkout Form Submission
    checkoutForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (paymentProcessing) return;
        paymentProcessing = true;
        
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            wilaya: document.getElementById('wilaya').value,
            address: document.getElementById('address').value,
            phone: document.getElementById('phone').value,
            notes: document.getElementById('notes').value,
            products: cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            })),
            total: parseFloat(cartTotal.textContent),
            payment_method: selectedPaymentMethod,
            payment_option: selectedPaymentOption
        };
        
        currentOrderData = formData;
        
        // Validate form
        if (!validatePhone(formData.phone)) {
            alert('Please enter a valid Algerian phone number (e.g., 0550123456 or +213550123456)');
            paymentProcessing = false;
            return;
        }
        
        if (!formData.email.includes('@') || !formData.email.includes('.')) {
            alert('Please enter a valid email address');
            paymentProcessing = false;
            return;
        }
        
        // Handle different payment methods
        if (selectedPaymentMethod === 'cash') {
            processCashPayment(formData);
        } else if (selectedPaymentMethod === 'online') {
            processOnlinePayment(formData);
        } else {
            alert('Please select a payment method');
            paymentProcessing = false;
        }
    });

    // Helper Functions
    function openProductModal(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        document.getElementById('modalProductName').textContent = product.name;
        document.getElementById('modalProductDescription').textContent = product.description;
        document.getElementById('modalProductPrice').textContent = `${product.price} DZD`;
        
        const featuresList = document.getElementById('modalProductFeatures');
        featuresList.innerHTML = '';
        product.features.split(',').forEach(feature => {
            const li = document.createElement('li');
            li.textContent = feature.trim();
            featuresList.appendChild(li);
        });
        
        const videoElement = document.getElementById('modalProductVideo');
        if (product.video) {
            videoElement.querySelector('source').src = product.video;
            videoElement.load();
        }
        
        modalAddToCartBtn.setAttribute('data-product-id', productId);
        productModal.style.display = 'flex';
    }

    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: productId,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }
        
        updateCart();
        showToast(`${product.name} added to cart!`);
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    function updateCart() {
        cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCartItems();
    }

    function renderCartItems() {
        cartItemsContainer.innerHTML = '';
        let total = 0;
        
        cart.forEach(item => {
            total += item.price * item.quantity;
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-image" style="background-image: url('${item.image}')"></div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price} DZD × ${item.quantity}</div>
                </div>
                <button class="cart-item-remove" data-id="${item.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            cartItemsContainer.appendChild(cartItem);
        });
        
        cartTotal.textContent = total.toFixed(2);
        
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                removeFromCart(itemId);
            });
        });
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        updateCart();
        showToast('Item removed from cart');
    }

    function validatePhone(phone) {
        const pattern = /^(\+213|0)(5|6|7)[0-9]{8}$/;
        return pattern.test(phone);
    }

    function processCashPayment(orderData) {
        fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...orderData,
                status: 'pending'
            })
        })
        .then(response => response.json())
        .then(data => {
            paymentProcessing = false;
            showPaymentSuccess('Order placed successfully! We will contact you soon.');
            resetCart();
        })
        .catch(error => {
            paymentProcessing = false;
            showPaymentError('Failed to place order. Please try again.');
        });
    }

    function processOnlinePayment(orderData) {
        document.getElementById('paymentDetails').style.display = 'block';
        
        if (selectedPaymentOption === 'paypal') {
            document.getElementById('paypalContainer').style.display = 'block';
            document.getElementById('stripeContainer').style.display = 'none';
            document.getElementById('baridimobContainer').style.display = 'none';
            document.getElementById('ccpContainer').style.display = 'none';
            
            paypal.Buttons({
                createOrder: function(data, actions) {
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                value: (orderData.total / 130).toFixed(2),
                                currency_code: 'USD'
                            }
                        }]
                    });
                },
                onApprove: function(data, actions) {
                    return actions.order.capture().then(function(details) {
                        completeOrder(orderData, {
                            payment_id: details.id,
                            method: 'paypal',
                            amount: orderData.total,
                            currency: 'DZD'
                        });
                    });
                },
                onError: function(err) {
                    showPaymentError(err.toString());
                }
            }).render('#paypal-button-container');
        } 
        else if (selectedPaymentOption === 'stripe') {
            document.getElementById('paypalContainer').style.display = 'none';
            document.getElementById('stripeContainer').style.display = 'block';
            document.getElementById('baridimobContainer').style.display = 'none';
            document.getElementById('ccpContainer').style.display = 'none';
            
            const style = {
                base: {
                    color: '#32325d',
                    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                    fontSmoothing: 'antialiased',
                    fontSize: '16px',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            };

            cardElement = elements.create('card', { style: style });
            cardElement.mount('#card-element');
            
            cardElement.addEventListener('change', function(event) {
                const displayError = document.getElementById('card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                } else {
                    displayError.textContent = '';
                }
            });
            
            // Create payment intent and confirm card payment
            fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: Math.round(orderData.total * 100),
                    currency: 'dzd'
                })
            })
            .then(response => response.json())
            .then(data => {
                return stripe.confirmCardPayment(data.clientSecret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: `${orderData.firstName} ${orderData.lastName}`,
                            email: orderData.email,
                            phone: orderData.phone,
                            address: {
                                city: orderData.wilaya,
                                line1: orderData.address
                            }
                        }
                    }
                });
            })
            .then(result => {
                if (result.error) {
                    showPaymentError(result.error.message);
                } else {
                    completeOrder(orderData, {
                        payment_id: result.paymentIntent.id,
                        method: 'stripe',
                        amount: orderData.total,
                        currency: 'DZD'
                    });
                }
            })
            .catch(error => {
                showPaymentError(error.message);
            });
        }
        else if (selectedPaymentOption === 'baridimob') {
            document.getElementById('paypalContainer').style.display = 'none';
            document.getElementById('stripeContainer').style.display = 'none';
            document.getElementById('baridimobContainer').style.display = 'block';
            document.getElementById('ccpContainer').style.display = 'none';
            
            const phone = document.getElementById('baridimobPhone').value;
            if (!phone || !validatePhone(phone)) {
                showPaymentError('Valid phone number is required for Baridi Mob');
                paymentProcessing = false;
                return;
            }
            
            // Simulate Baridi Mob payment
            fetch('/api/baridimob-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone,
                    amount: orderData.total
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    completeOrder(orderData, {
                        payment_id: data.transaction_id,
                        method: 'baridimob',
                        amount: orderData.total,
                        currency: 'DZD',
                        phone: phone
                    });
                } else {
                    showPaymentError(data.message || 'Baridi Mob payment failed');
                }
            })
            .catch(error => {
                showPaymentError('Failed to process Baridi Mob payment');
            });
        }
        else if (selectedPaymentOption === 'ccp') {
            document.getElementById('paypalContainer').style.display = 'none';
            document.getElementById('stripeContainer').style.display = 'none';
            document.getElementById('baridimobContainer').style.display = 'none';
            document.getElementById('ccpContainer').style.display = 'block';
            
            const reference = document.getElementById('ccpReference').value;
            if (!reference) {
                showPaymentError('Reference number is required for CCP');
                paymentProcessing = false;
                return;
            }
            
            // Simulate CCP payment
            fetch('/api/ccp-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reference: reference,
                    amount: orderData.total
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    completeOrder(orderData, {
                        payment_id: data.reference,
                        method: 'ccp',
                        amount: orderData.total,
                        currency: 'DZD',
                        reference: reference
                    });
                } else {
                    showPaymentError(data.message || 'CCP payment failed');
                }
            })
            .catch(error => {
                showPaymentError('Failed to process CCP payment');
            });
        }
    }

    function completeOrder(orderData, paymentData) {
        orderData.payment_details = paymentData;
        orderData.status = 'completed';
        
        fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        })
        .then(response => response.json())
        .then(data => {
            paymentProcessing = false;
            showPaymentSuccess('Order placed successfully!');
            resetCart();
        })
        .catch(error => {
            paymentProcessing = false;
            showPaymentError('Failed to complete order. Please contact support.');
        });
    }

    function showPaymentSuccess(message) {
        document.getElementById('paymentSuccessModal').style.display = 'flex';
        document.getElementById('paymentSuccessModal').querySelector('p').textContent = message;
        purchaseModal.style.display = 'none';
    }

    function showPaymentError(message) {
        document.getElementById('paymentErrorMsg').textContent = message;
        document.getElementById('paymentFailedModal').style.display = 'flex';
        purchaseModal.style.display = 'none';
        paymentProcessing = false;
    }

    function resetCart() {
        cart = [];
        updateCart();
        localStorage.removeItem('cart');
        selectedPaymentMethod = null;
        selectedPaymentOption = null;
        document.querySelectorAll('.payment-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        document.getElementById('checkoutForm').reset();
        document.getElementById('paymentDetails').style.display = 'none';
    }

    // Initialize cart on page load
    updateCart();

    // Add toast notification CSS
    const style = document.createElement('style');
    style.textContent = `
        .toast-notification {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .toast-notification.show {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
});
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.querySelector('.search-bar');
    const productCards = document.querySelectorAll('.product-card');

    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        productCards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            const desc = card.querySelector('.product-description').textContent.toLowerCase();
            if (name.includes(query) || desc.includes(query)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});