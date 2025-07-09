document.addEventListener('DOMContentLoaded', function() {
    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    
    mobileMenuBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    // Section Navigation
    const sections = {
        'home': document.getElementById('home'),
        'products': document.getElementById('products'),
        'orders': document.getElementById('orders'),
        'settings': document.getElementById('settings')
    };
    
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.getAttribute('href') === "{{ url_for('admin_logout') }}") {
                return;
            }
            
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            
            // Hide all sections
            Object.values(sections).forEach(section => {
                section.style.display = 'none';
            });
            
            // Show target section
            if (sections[target]) {
                sections[target].style.display = 'block';
                
                // Special handling for settings section
                if (target === 'settings') {
                    loadSettingsForm();
                }
            }
            
            // Update active menu item
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 992) {
                sidebar.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    });

    // Settings Form Handling
    function loadSettingsForm() {
        fetch('/admin/settings')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (data.settings) {
                    document.getElementById('siteTitle').value = data.settings.site_title || '';
                    document.getElementById('siteDescription').value = data.settings.site_description || '';
                    document.getElementById('welcomeTitle').value = data.settings.welcome_title || '';
                    document.getElementById('welcomeSubtitle').value = data.settings.welcome_subtitle || '';
                    
                    if (data.settings.logo) {
                        document.getElementById('logoPreview').src = data.settings.logo;
                    }
                }
            })
            .catch(error => {
                console.error('Error loading settings:', error);
                showToast('Failed to load settings', 'error');
            });
    }

    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            fetch('/admin/settings', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    showToast('Settings saved successfully', 'success');
                    const logoFile = document.getElementById('logo').files[0];
                    if (logoFile) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('logoPreview').src = e.target.result;
                        };
                        reader.readAsDataURL(logoFile);
                    }
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            })
            .catch(error => {
                showToast('Error saving settings: ' + error.message, 'error');
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
            });
        });
    }

    // Sales Details Toggle
    const toggleSalesBtn = document.getElementById('toggleSalesBtn');
    const salesDetails = document.getElementById('salesDetails');
    
    if (toggleSalesBtn && salesDetails) {
        toggleSalesBtn.addEventListener('click', function() {
            salesDetails.classList.toggle('show');
            this.querySelector('i').classList.toggle('fa-chevron-down');
            this.querySelector('i').classList.toggle('fa-chevron-up');
        });
    }

    // View All Orders Button
    const viewAllOrdersBtn = document.getElementById('viewAllOrdersBtn');
    if (viewAllOrdersBtn) {
        viewAllOrdersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToSection('orders');
        });
    }

    // Product Form Handling
    const productFormSection = document.getElementById('productFormSection');
    const addProductBtn = document.getElementById('addProductBtn');
    const cancelProductForm = document.getElementById('cancelProductForm');
    const productForm = document.getElementById('productForm');
    
    if (addProductBtn) {
        addProductBtn.addEventListener('click', function() {
            resetProductForm();
            productForm.action = "{{ url_for('add_product') }}";
            productFormSection.style.display = 'block';
            window.scrollTo({ top: productFormSection.offsetTop, behavior: 'smooth' });
        });
    }
    
    if (cancelProductForm) {
        cancelProductForm.addEventListener('click', function() {
            productFormSection.style.display = 'none';
        });
    }
    
    function resetProductForm() {
        document.getElementById('productFormTitle').textContent = 'Add New Product';
        document.getElementById('productId').value = '';
        document.getElementById('productForm').reset();
        document.getElementById('productImagePreview').style.display = 'none';
        document.getElementById('productBackgroundImagePreview').style.display = 'none';
    }

    // Edit Product Buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            document.getElementById('productFormTitle').textContent = 'Edit Product';
            document.getElementById('productId').value = productId;
            productForm.action = `/admin/edit_product/${productId}`;
            productFormSection.style.display = 'block';
            window.scrollTo({ top: productFormSection.offsetTop, behavior: 'smooth' });
        });
    });

    // Delete Product Buttons
    document.querySelectorAll('.delete-btn:not(.delete-order-btn)').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            showConfirmationModal(
                'Delete Product',
                'Are you sure you want to delete this product?',
                () => {
                    fetch(`/admin/delete_product/${productId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(handleResponse)
                    .then(data => {
                        if (data.success) {
                            showToast('Product deleted successfully', 'success');
                            location.reload();
                        }
                    })
                    .catch(handleError);
                }
            );
        });
    });

    // Bulk Delete Buttons
    document.getElementById('removeAllProductsBtn')?.addEventListener('click', function() {
        showConfirmationModal(
            'Delete All Products',
            'This will permanently delete ALL products. This action cannot be undone!',
            () => {
                fetch('/admin/delete_all_products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                .then(handleResponse)
                .then(data => {
                    if (data.success) {
                        showToast('All products deleted successfully', 'success');
                        location.reload();
                    }
                })
                .catch(handleError);
            }
        );
    });

    document.getElementById('removeAllOrdersBtn')?.addEventListener('click', function() {
        showConfirmationModal(
            'Delete All Orders',
            'This will permanently delete ALL orders. This action cannot be undone!',
            () => {
                fetch('/admin/delete_all_orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                .then(handleResponse)
                .then(data => {
                    if (data.success) {
                        showToast('All orders deleted successfully', 'success');
                        location.reload();
                    }
                })
                .catch(handleError);
            }
        );
    });

    // Delete Order Buttons
    document.querySelectorAll('.delete-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            showConfirmationModal(
                'Delete Order',
                'Are you sure you want to delete this order?',
                () => {
                    fetch(`/admin/delete_order/${orderId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(handleResponse)
                    .then(data => {
                        if (data.success) {
                            showToast('Order deleted successfully', 'success');
                            location.reload();
                        }
                    })
                    .catch(handleError);
                }
            );
        });
    });

    // Image Preview Handlers
    setupImagePreview('productImage', 'productImagePreview');
    setupImagePreview('productBackgroundImage', 'productBackgroundImagePreview');
    setupImagePreview('logo', 'logoPreview');

    function setupImagePreview(inputId, previewId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        
        if (input && preview) {
            input.addEventListener('change', function(e) {
                if (this.files && this.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(this.files[0]);
                }
            });
        }
    }

    // Order Status Change Handler
    document.querySelectorAll('.order-status').forEach(select => {
        select.addEventListener('change', function() {
            const orderId = this.getAttribute('data-order-id');
            const status = this.value;
            const statusSpan = this.closest('tr').querySelector('.status');
            
            // Show loading state
            const originalValue = this.value;
            this.disabled = true;
            this.innerHTML = '<option value="">Updating...</option>';
            
            fetch(`/admin/update_order_status/${orderId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `status=${status}`
            })
            .then(handleResponse)
            .then(data => {
                if (data.success) {
                    if (statusSpan) {
                        statusSpan.className = 'status status-' + status;
                        statusSpan.textContent = 
                            status === 'pending' ? 'Pending' :
                            status === 'processing' ? 'Processing' :
                            status === 'completed' ? 'Completed' : 'Cancelled';
                    }
                    showToast('Order status updated successfully', 'success');
                }
            })
            .catch(error => {
                this.value = originalValue;
                showToast('Error updating order status', 'error');
            })
            .finally(() => {
                this.disabled = false;
                this.innerHTML = `
                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="processing" ${status === 'processing' ? 'selected' : ''}>Processing</option>
                    <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                `;
            });
        });
    });

    // Chart Initialization
    const chartCanvas = document.getElementById('chartCanvas');
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Sales (DZD)',
                    data: [12000, 19000, 3000, 5000, 2000, 3000],
                    backgroundColor: 'rgba(67, 97, 238, 0.2)',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 14 },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 4
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + ' DZD';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // Chart Type Toggle
        const chartToggleButtons = document.querySelectorAll('.chart-toggle button');
        chartToggleButtons.forEach(button => {
            button.addEventListener('click', function() {
                const chartType = this.getAttribute('data-chart');
                chartToggleButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Update chart based on selection
                // This is a simplified example - you would need to implement
                // the actual data loading for different chart types
                console.log('Switched to:', chartType);
            });
        });
    }

    // Search Functionality
    const searchOrdersInput = document.getElementById('searchOrders');
    if (searchOrdersInput) {
        searchOrdersInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#ordersTable tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Initialize with home section visible
    if (sections['home']) {
        sections['home'].style.display = 'block';
    }

    // Helper Functions
    function navigateToSection(sectionId) {
        Object.values(sections).forEach(section => {
            section.style.display = 'none';
        });
        sections[sectionId].style.display = 'block';
        
        menuItems.forEach(i => i.classList.remove('active'));
        document.querySelector(`.menu-item[href="#${sectionId}"]`).classList.add('active');
        
        if (window.innerWidth <= 992) {
            sidebar.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    }

    function handleResponse(response) {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    }

    function handleError(error) {
        console.error('Error:', error);
        showToast('An error occurred. Please try again.', 'error');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
                 type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : 
                 '<i class="fas fa-info-circle"></i>'}
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function showConfirmationModal(title, message, confirmCallback) {
        // In a real implementation, you would use a proper modal component
        if (confirm(message)) {
            confirmCallback();
        }
    }
});