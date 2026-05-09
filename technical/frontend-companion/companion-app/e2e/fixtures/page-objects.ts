import { Page, Locator } from '@playwright/test';

/**
 * HomePage Page Object
 * Represents the home page of the Companion app
 */
export class HomePage {
  readonly page: Page;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly healthCheckButton: Locator;
  readonly healthStatus: Locator;
  readonly routeLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=Companion App - Milestone 0');
    this.subtitle = page.locator('text=/Environment:.*');
    this.healthCheckButton = page.locator('button:has-text("Check Health")');
    this.healthStatus = page.locator('text=/Status:.*');
    this.routeLinks = page.locator('a[href*="/"]');
  }

  /**
   * Navigate to home page
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click the health check button
   */
  async clickHealthCheck() {
    await this.healthCheckButton.click();
    await this.page.waitForTimeout(1000); // Wait for API call
  }

  /**
   * Get the current health status text
   */
  async getHealthStatus() {
    return this.healthStatus.textContent();
  }

  /**
   * Get the environment display text
   */
  async getEnvironmentText() {
    return this.subtitle.textContent();
  }

  /**
   * Navigate to a specific route
   */
  async navigateToRoute(routeName: string) {
    const link = this.page.locator(`a:has-text("${routeName}")`);
    await link.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get all available route links
   */
  async getAllRoutes() {
    return this.routeLinks.all();
  }

  /**
   * Check if title is visible
   */
  async isTitleVisible() {
    return this.title.isVisible();
  }
}

/**
 * OnboardingPage Page Object
 */
export class OnboardingPage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=Onboarding');
  }

  async goto() {
    await this.page.goto('/onboarding');
    await this.page.waitForLoadState('networkidle');
  }

  async isTitleVisible() {
    return this.title.isVisible();
  }
}

/**
 * LocationPage Page Object
 */
export class LocationPage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=Location');
  }

  async goto() {
    await this.page.goto('/location');
    await this.page.waitForLoadState('networkidle');
  }

  async isTitleVisible() {
    return this.title.isVisible();
  }
}

/**
 * BookingPage Page Object
 */
export class BookingPage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=/Calendar|Time|Companion Type|Book Now|Confirmation/');
  }

  async goto(step: 'calendar' | 'time' | 'companion-type' | 'book-now' | 'confirmation') {
    await this.page.goto(`/booking/${step}`);
    await this.page.waitForLoadState('networkidle');
  }

  async isTitleVisible() {
    return this.title.isVisible();
  }
}

/**
 * MatchingPage Page Object
 */
export class MatchingPage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=Matching');
  }

  async goto() {
    await this.page.goto('/matching');
    await this.page.waitForLoadState('networkidle');
  }

  async isTitleVisible() {
    return this.title.isVisible();
  }
}

/**
 * InServicePage Page Object
 */
export class InServicePage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=In Service');
  }

  async goto() {
    await this.page.goto('/in-service');
    await this.page.waitForLoadState('networkidle');
  }

  async isTitleVisible() {
    return this.title.isVisible();
  }
}

/**
 * FeedbackPage Page Object
 */
export class FeedbackPage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('text=Feedback');
  }

  async goto() {
    await this.page.goto('/feedback');
    await this.page.waitForLoadState('networkidle');
  }

  async isTitleVisible() {
    return this.title.isVisible();
  }
}
