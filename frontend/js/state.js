/**
 * Global application state for authentication and user info.
 */
export const state = {
    user: null, // { id, username, role }

    setUser(userData) {
        this.user = userData;
        // Trigger any UI updates if necessary
        document.dispatchEvent(new CustomEvent("authStateChanged", { detail: userData }));
    },

    isLoggedIn() {
        return !!this.user;
    },

    hasRole(...roles) {
        if (!this.user) return false;
        return roles.includes(this.user.role);
    },

    canWrite() {
        return this.hasRole("admin", "editor");
    },

    isAdmin() {
        return this.hasRole("admin");
    }
};
