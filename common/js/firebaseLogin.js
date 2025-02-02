import { authService } from './firebaseAuthService.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

const messages = {
  auth: {
    titleSignIn: '{{ auth_modal.title_sign_in }}',
    passwordPlaceholder: '{{ auth_modal.password_placeholder }}',
    submitSignIn: '{{ auth_modal.submit_sign_in }}',
    createAccount: '{{ auth_modal.create_account }}',
    namePlaceholder: '{{ auth_modal.name_placeholder }}',
    emailPlaceholder: '{{ auth_modal.email_placeholder }}',
    forgotPassword: '{{ auth_modal.forgot_password }}',
    errorWrongPassword: '{{ auth_modal.error_wrong_password }}',
    errorEmailNotFound: '{{ auth_modal.error_email_not_found }}',
    promptResetPassword: '{{ auth_modal.prompt_reset_password }}',
    promptCreateAccount: '{{ auth_modal.prompt_create_account }}',
    already_logged_in: '{{ auth_modal.already_logged_in }}',
    as_email: '{{ auth_modal.as_email }}',
    continue_as_user: '{{ auth_modal.continue_as_user }}',
    logout_and_switch: '{{ auth_modal.logout_and_switch }}',
    error_invalid_credential: '{{ auth_modal.error_invalid_credential }}',
    error_too_many_requests: '{{ auth_modal.error_too_many_requests }}',
  },
  submission: {
    passwordResetSent: '{{ submission_flow.password_reset_sent }}',
  },
};
console.log(messages.auth.titleSignIn);
console.log(messages.auth.namePlaceholder);
console.log(messages.auth.emailPlaceholder);
console.log(messages.auth.passwordPlaceholder);
console.log(messages.auth.submitSignIn);
console.log(messages.auth.createAccount);
console.log(messages.auth.forgotPassword);

export function initializeHeaderLogin() {
  console.log('Initializing header login...');
  const modalContainer = document.querySelector('.auth-modal-container');
  const loginContainer = document.querySelector('.login-container');

  // Get all form containers
  const loginFormContainer = document.getElementById('loginForm');
  const createAccountContainer = document.getElementById('createAccountForm');
  const resetPasswordContainer = document.getElementById('resetPasswordForm');
  const loggedInUserContainer = document.getElementById('loggedInUserForm');

  // Get forms
  const loginForm = document.getElementById('authForm');
  const signupForm = document.getElementById('signupForm');
  const resetForm = document.getElementById('resetForm');

  // Get error divs
  const loginError = document.getElementById('loginError');
  const signupError = document.getElementById('signupError');
  const resetError = document.getElementById('resetError');

  // Initialize Firebase Auth - MODIFIED
  let auth;
  let authStateUnsubscribe = null;

  // First check sessionStorage
  const storedUser = sessionStorage.getItem('authUser');
  if (storedUser) {
    // If we have stored user data, use it immediately
    updateUIFromStoredUser(JSON.parse(storedUser));
    console.log('Stored user data:', storedUser);
  }

  // Then initialize Firebase Auth
  authService.getAuth().then((firebaseAuth) => {
    auth = firebaseAuth;

    // Only do initial Firebase check if we don't have stored data
    if (!storedUser) {
      const initialCheck = auth.onAuthStateChanged((user) => {
        updateLoginState(auth);
        initialCheck();
      });
    }

    // Only listen for subsequent auth state changes when modal is open
    loginContainer.addEventListener('click', () => {
      if (!authStateUnsubscribe) {
        authStateUnsubscribe = auth.onAuthStateChanged((user) =>
          updateLoginState(auth)
        );
      }
    });

    // Clean up listener when modal closes
    const closeModal = () => {
      modalContainer.style.display = 'none';
      resetForms();
      if (authStateUnsubscribe) {
        authStateUnsubscribe();
        authStateUnsubscribe = null;
      }
    };

    // Update close handlers
    modalContainer
      .querySelector('.auth-modal-backdrop')
      .addEventListener('click', closeModal);
    document
      .getElementById('continueAsUser')
      .addEventListener('click', closeModal);
  });

  // Show modal when login icon is clicked
  loginContainer.addEventListener('click', async () => {
    const user = auth.currentUser;
    modalContainer.style.display = 'block';

    if (user) {
      // Show logged in user modal
      showLoggedInUserModal(user);
    } else {
      // Show regular login form
      showForm('login');
    }
  });

  // Handle continue as user
  document.getElementById('continueAsUser').addEventListener('click', () => {
    modalContainer.style.display = 'none';
  });

  // Handle logout and switch
  document
    .getElementById('logoutAndSwitch')
    .addEventListener('click', async () => {
      try {
        await signOut(auth);
        showForm('login');
      } catch (error) {
        console.error('Error signing out:', error);
      }
    });

  // Close modal when clicking backdrop
  const backdrop = modalContainer.querySelector('.auth-modal-backdrop');
  backdrop.addEventListener('click', () => {
    modalContainer.style.display = 'none';
    resetForms();
  });

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const errorResetLink = document.getElementById('errorResetLink');
    const errorCreateLink = document.getElementById('errorCreateLink');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      modalContainer.style.display = 'none';
      resetForms();
    } catch (error) {
      console.log('error.code', error.code);

      if (error.code === 'auth/invalid-credential') {
        // Show wrong password error with reset link
        errorDiv.textContent = messages.auth.errorWrongPassword;
        errorResetLink.style.display = 'block';
        errorCreateLink.style.display = 'none';
        errorResetLink.onclick = (e) => {
          e.preventDefault();
          showForm('reset');
          document.getElementById('resetEmail').value = email;
        };
      } else if (error.code === 'auth/user-not-found') {
        // Show user not found error with create account link
        errorDiv.textContent = messages.auth.errorEmailNotFound;
        errorResetLink.style.display = 'none';
        errorCreateLink.style.display = 'block';
        errorCreateLink.onclick = (e) => {
          e.preventDefault();
          showForm('create');
          document.getElementById('signupEmail').value = email;
        };
      } else if (error.code === 'auth/too-many-requests') {
        errorDiv.textContent = messages.auth.error_too_many_requests;
        errorResetLink.style.display = 'block';
        errorCreateLink.style.display = 'none';
        errorResetLink.onclick = (e) => {
          e.preventDefault();
          showForm('reset');
          document.getElementById('resetEmail').value = email;
        };
      } else {
        errorDiv.textContent = messages.auth.error_invalid_credential;
        errorResetLink.style.display = 'none';
        errorCreateLink.style.display = 'none';
      }
    }
  });

  // Handle create account form submission
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      // Update the display name
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Send verification email
      await sendEmailVerification(userCredential.user);

      // Update success message with user details
      document.getElementById('newUserName').textContent = name;
      document.getElementById('newUserEmail').textContent = email;

      // Show success message
      showForm('success');

      // Add event listener to continue button
      document
        .getElementById('successContinue')
        .addEventListener('click', () => {
          modalContainer.style.display = 'none';
          resetForms();
        });

      // Auto-hide modal after 5 seconds
      setTimeout(() => {
        modalContainer.style.display = 'none';
        resetForms();
      }, 5000);
    } catch (error) {
      signupError.textContent = error.message;
    }
  });

  // Handle password reset form submission
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;

    try {
      await sendPasswordResetEmail(auth, email);
      alert(messages.submission.passwordResetSent);
      showForm('login');
    } catch (error) {
      resetError.textContent = error.message;
    }
  });

  // Navigation between forms
  document
    .getElementById('showCreateAccount')
    .addEventListener('click', () => showForm('create'));
  document
    .getElementById('showResetPassword')
    .addEventListener('click', () => showForm('reset'));
  document
    .getElementById('backToLogin')
    .addEventListener('click', () => showForm('login'));
  document
    .getElementById('backToLoginFromReset')
    .addEventListener('click', () => showForm('login'));

  // Helper functions
  function showForm(formType) {
    loginFormContainer.style.display = 'none';
    createAccountContainer.style.display = 'none';
    resetPasswordContainer.style.display = 'none';
    loggedInUserContainer.style.display = 'none';
    document.getElementById('accountCreatedForm').style.display = 'none';

    switch (formType) {
      case 'login':
        loginFormContainer.style.display = 'block';
        break;
      case 'create':
        createAccountContainer.style.display = 'block';
        break;
      case 'reset':
        resetPasswordContainer.style.display = 'block';
        break;
      case 'logged-in':
        loggedInUserContainer.style.display = 'block';
        break;
      case 'success':
        document.getElementById('accountCreatedForm').style.display = 'block';
        break;
    }
  }

  function showLoggedInUserModal(user) {
    const userNameElement = document.getElementById('currentUserName');
    const userEmailElement = document.getElementById('currentUserEmail');

    userNameElement.textContent = user.displayName || 'User';
    userEmailElement.textContent = `${messages.auth.as_email}: ${user.email}`;

    showForm('logged-in');

    // Auto-close modal and cleanup listener after successful login
    setTimeout(() => {
      if (authStateUnsubscribe) {
        authStateUnsubscribe();
        authStateUnsubscribe = null;
      }
      modalContainer.style.display = 'none';
    }, 2000);
  }

  function resetForms() {
    loginForm.reset();
    signupForm.reset();
    resetForm.reset();
    loginError.textContent = '';
    signupError.textContent = '';
    resetError.textContent = '';
    document.getElementById('errorResetLink').style.display = 'none';
    document.getElementById('errorCreateLink').style.display = 'none';

    if (authStateUnsubscribe) {
      authStateUnsubscribe();
      authStateUnsubscribe = null;
    }
  }
}

function updateLoginState(auth) {
  const loginContainer = document.querySelector('.login-container');
  const userDisplayName = document.getElementById('currentUserDisplayName');
  const loginText = document.getElementById('loginText');
  if (!loginContainer || !userDisplayName) return;

  const user = auth.currentUser;

  // Store auth state in sessionStorage to avoid needing constant listener
  if (user) {
    sessionStorage.setItem(
      'authUser',
      JSON.stringify({
        email: user.email,
        displayName: user.displayName || 'User',
      })
    );
  } else {
    sessionStorage.removeItem('authUser');
  }

  // Update UI based on current state
  if (user) {
    loginContainer.setAttribute('name', 'person-circle');
    loginContainer.style.color = 'var(--color-primary)';
    userDisplayName.textContent = user.displayName || 'User';
    userDisplayName.style.display = 'block';
    loginText.style.display = 'none';
  } else {
    loginContainer.setAttribute('name', 'person-circle-outline');
    loginContainer.style.color = 'var(--color-primary-shade)';
    userDisplayName.style.display = 'none';
    loginText.style.display = 'block';
    userDisplayName.textContent = '';
  }
}

// Helper function to update UI from stored user data
function updateUIFromStoredUser(userData) {
  const loginContainer = document.querySelector('.login-container');
  const userDisplayName = document.getElementById('currentUserDisplayName');
  const loginText = document.getElementById('loginText');

  if (!loginContainer || !userDisplayName) return;

  loginContainer.setAttribute('name', 'person-circle');
  loginContainer.style.color = 'var(--color-primary)';
  userDisplayName.textContent = userData.displayName;
  userDisplayName.style.display = 'block';
  loginText.style.display = 'none';
}

export { updateLoginState };
