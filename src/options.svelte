<script>
  import {
    getConfiguration,
    normalizeConfiguration,
    saveConfiguration,
  } from "./configuration.js";
  import { LinkdingApi } from "./linkding.js";
  import { ReadeckApi } from "./readeck.js";

  let config = normalizeConfiguration();
  let connection;

  getConfiguration().then((saved) => (config = saved));

  async function handleSubmit() {
    try {
      const tests = [];
      if (config.linkding.enabled) {
        tests.push(new LinkdingApi(config.linkding).testConnection());
      }
      if (config.readeck.enabled) {
        tests.push(new ReadeckApi(config.readeck).testConnection());
      }

      const results = await Promise.all(tests);
      connection = results.find((result) => !result.success) || {
        success: true,
        status: 200,
        message: "Connection successful",
      };
      if (connection.success) await saveConfiguration(config);
    } catch (error) {
      connection = {
        success: false,
        status: null,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
</script>

<h6>Configuration</h6>
<div class="divider" />
<p>
  Search Linkding, Readeck, or both whenever you use a supported search engine.
  Credentials stay in extension storage and are never sent to search pages.
</p>
<form class="form" on:submit|preventDefault={handleSubmit}>
  <h6>Linkding</h6>
  <div class="form-group">
    <label class="form-checkbox">
      <input type="checkbox" bind:checked={config.linkding.enabled} />
      <i class="form-icon"></i> Search Linkding
    </label>
  </div>
  <div class="form-group">
    <label class="form-label" for="input-linkding-url">Base URL</label>
    <input class="form-input" type="url" id="input-linkding-url"
      placeholder="https://linkding.example" bind:value={config.linkding.baseUrl} />
  </div>
  <div class="form-group">
    <label class="form-label" for="input-linkding-token">API token</label>
    <input class="form-input" type="password" id="input-linkding-token"
      placeholder="Token" bind:value={config.linkding.token} />
  </div>
  <div class="form-group">
    <label class="form-label" for="input-search-num">Maximum results</label>
    <input
      class="form-input"
      type="number"
      id="input-search-num"
      min="1"
      bind:value={config.resultNum}
    />
    <div class="form-input-hint">
      Applies to Linkding. Readeck is always limited to its ten best matches.
    </div>
  </div>

  <div class="divider" />
  <h6>Readeck</h6>
  <div class="form-group">
    <label class="form-checkbox">
      <input type="checkbox" bind:checked={config.readeck.enabled} />
      <i class="form-icon"></i> Search Readeck
    </label>
  </div>
  <div class="form-group">
    <label class="form-label" for="input-readeck-url">Base URL</label>
    <input class="form-input" type="url" id="input-readeck-url"
      placeholder="https://readeck.example" bind:value={config.readeck.baseUrl} />
    <div class="form-input-hint">HTTPS is required.</div>
  </div>
  <div class="form-group">
    <label class="form-label" for="input-readeck-token">Read-only API token</label>
    <input class="form-input" type="password" id="input-readeck-token"
      placeholder="Token" bind:value={config.readeck.token} />
    <div class="form-input-hint">Create a token limited to bookmark read access.</div>
  </div>
  <div class="form-group">
    <label class="form-checkbox">
      <input type="checkbox" bind:checked={config.readeck.enrichAnnotations} />
      <i class="form-icon"></i> Show highlights and notes for the first 10 matches
    </label>
  </div>
  <div class="accordion">
    <input type="checkbox" id="accordion-1" name="accordion-checkbox" hidden />
    <label class="accordion-header" for="accordion-1">
      <i class="icon-arrow-right mr-1 icon" />
      Advanced Settings
    </label>
    <div class="accordion-body">
      <div class="form-group">
        <div class="form-label">Default open link type</div>
        <label class="form-radio">
          <input type="radio" bind:group={config.openLinkType} value="newTab" />
          <i class="form-icon" />Open links in a new tab (default)
        </label>
        <label class="form-radio">
          <input type="radio" bind:group={config.openLinkType} value="sameTab" />
          <i class="form-icon" />Open links in the same tab
        </label>
      </div>
      <div class="form-group">
        <label class="form-checkbox">
          <input
            type="checkbox"
            bind:checked={config.showLogo}
          />
        <i class="form-icon"></i>
        <span>Show logo</span>
      </label>
        <div class="form-input-hint">
          Shows or hides the extension logo on the results title.
        </div>
      </div>
      <div class="form-group p-relative clearfix">
        <div class="form-label">Theme of injection box</div>
        <div class="float-left form-label">google</div>
        <label class="form-inline float-right form-radio">
          <input
            type="radio"
            id="google-light"
            bind:group={config.themeGoogle}
            value="light"
          />
          <i class="form-icon" />light
        </label>
        <label class="form-inline float-right form-radio">
          <input
            type="radio"
            id="google-dark"
            bind:group={config.themeGoogle}
            value="dark"
          />
          <i class="form-icon" />dark
        </label>
        <label class="form-inline float-right form-radio">
          <input
            type="radio"
            id="google-auto"
            bind:group={config.themeGoogle}
            value="auto"
          />
          <i class="form-icon" />auto (default)
        </label>
      </div>
      <div class="form-group p-relative clearfix">
        <div class="float-left form-label">DuckDuckGo</div>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeDuckduckgo} value="light" />
          <i class="form-icon" />light
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeDuckduckgo} value="dark" />
          <i class="form-icon" />dark
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeDuckduckgo} value="auto" />
          <i class="form-icon" />auto (default)
        </label>
      </div>
      <div class="form-group p-relative clearfix">
        <div class="float-left form-label">Brave Search†</div>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeBrave} value="light" />
          <i class="form-icon" />light
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeBrave} value="dark" />
          <i class="form-icon" />dark
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeBrave} value="auto" />
          <i class="form-icon" />auto (default)
        </label>
      </div>
      <div class="form-group p-relative clearfix">
        <div class="float-left form-label">SearX/SearXNG†</div>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeSearx} value="light" />
          <i class="form-icon" />light
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeSearx} value="dark" />
          <i class="form-icon" />dark
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeSearx} value="auto" />
          <i class="form-icon" />auto (default)
        </label>
      </div>
      <div class="form-group p-relative clearfix">
        <div class="float-left form-label">Kagi Search</div>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeKagi} value="light" />
          <i class="form-icon" />light
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeKagi} value="dark" />
          <i class="form-icon" />dark
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeKagi} value="auto" />
          <i class="form-icon" />auto (default)
        </label>
      </div>
      <div class="form-group p-relative clearfix">
        <div class="float-left form-label">Qwant</div>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeQwant} value="light" />
          <i class="form-icon" />light
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeQwant} value="dark" />
          <i class="form-icon" />dark
        </label>
        <label class="form-inline float-right form-radio">
          <input type="radio" bind:group={config.themeQwant} value="auto" />
          <i class="form-icon" />auto (default)
        </label>
      </div>
      <div class="form-input-hint">
        † Automatic theme detection may fail with these search engines unless
        you set a specific theme (not 'system') in the search engine settings.
      </div>
    </div>
  </div>

  <div class="divider" />

  <div class="button-row">
    {#if connection?.success}
      <div class="form-group mr-2 has-success form-input-hint">
        <i class="icon icon-check" /> {connection.message}
      </div>
    {:else if connection}
      <div class="form-group mr-2 has-error form-input-hint">
        <div><i class="icon icon-cross" /> Connection failed</div>
        {#if connection.status}<div><b>Status Code:</b> {connection.status}</div>{/if}
        <div><b>Error:</b> {connection.message}</div>
      </div>
    {:else}
      <div></div>
    {/if}
    <button
      type="submit"
      class="ml-2 btn btn-primary"
      disabled={!((config.linkding.enabled && config.linkding.baseUrl && config.linkding.token) ||
        (config.readeck.enabled && config.readeck.baseUrl && config.readeck.token))}
    >
      Save
    </button>
  </div>
</form>

<style>
  .button-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .button-row button {
    padding-left: 32px;
    padding-right: 32px;
  }
</style>
