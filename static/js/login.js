function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = window.innerWidth < 480 ? 15 : 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const size = Math.random() * 4 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        const duration = Math.random() * 10 + 10;
        particle.style.animation = `float ${duration}s linear infinite`;
        
        particle.style.animationDelay = `${Math.random() * 10}s`;
        
        particle.style.opacity = Math.random() * 0.5 + 0.1;
        
        particlesContainer.appendChild(particle);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    
    const inputs = document.querySelectorAll('input');
    const loginBtn = document.querySelector('.login-btn');
    const togglePassword = document.getElementById('togglePassword');
    const password = document.getElementById('password');
    
    togglePassword.addEventListener('click', function() {
        const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
        password.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
    
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.parentElement.querySelector('label').style.color = '#00ffcc';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.parentElement.querySelector('label').style.color = '#cccccc';
        });
    });
    
    document.querySelector('form').addEventListener('submit', function(e) {
        loginBtn.classList.add('loading');
        
        setTimeout(() => {
            loginBtn.classList.remove('loading');
        }, 3000);
    });
});