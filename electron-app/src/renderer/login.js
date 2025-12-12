document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const createAccountBtn = document.getElementById('createAccountBtn');
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

  // Handle form submission
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert('Please fill in all fields');
      return;
    }

    console.log('Sign in:', { username, password });
    // Add your login logic here
    // Example: send credentials to server
    // fetch('/api/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ username, password })
    // }).then(response => response.json())
    //   .then(data => console.log('Login successful:', data))
    //   .catch(error => console.error('Login failed:', error));
  });

  // Handle Create Account button
  createAccountBtn.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Create Account clicked');
    // Add your create account logic here
  });

  // Handle Forgot Password button
  forgotPasswordBtn.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Forgot Password clicked');
    // Add your forgot password logic here
  });
});
