import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Polyfill browser globals for Node SSR execution
if (!globalThis.localStorage) {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}
if (!globalThis.window) {
  globalThis.window = globalThis;
}
if (!globalThis.navigator) {
  globalThis.navigator = { userAgent: 'NodeTestRunner' };
}

async function testRuntimeRender() {
  console.log('=== STARTING AUTOMATED RUNTIME SSR RENDER VERIFICATION ===\n');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const testCases = [
    {
      name: 'CommerceReportView (Fixed isPeriodAligned)',
      path: './src/CommerceReportView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        apiRequest: async () => ({ success: true, data: {} }),
        reportData: {
          period_meta: { start_date: '2026-09-01', end_date: '2026-09-20' },
          data_trust: { status: 'READY', is_reconciled: true },
          revenue_and_metrics_overview: {
            order_gross_value: 10000000,
            realized_order_value: 9000000,
            total_loss_value: 1000000
          },
          advertising_overview: {
            status: 'AVAILABLE',
            total_spend: 2000000,
            attributed_gmv: 8000000,
            roi: 4.0
          }
        }
      }
    },
    {
      name: 'CommerceAffiliateView (Phase D)',
      path: './src/CommerceAffiliateView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        apiRequest: async () => ({
          success: true,
          data: {
            summary: {
              affiliate_gmv: 50000000,
              affiliate_orders: 120,
              creator_count: 15,
              total_commission_est: 5000000,
              organic_gmv: 30000000,
              ads_gmv: 20000000
            },
            creators: [
              { creator_username: 'review_hot', creator_name: 'Lan Review', gmv: 25000000, order_count: 60, commission: 2500000 }
            ],
            formats: {
              video: { count: 10, gmv: 30000000, orders: 80 },
              live: { count: 5, gmv: 20000000, orders: 40 }
            }
          }
        })
      }
    },
    {
      name: 'CommerceLiveAnalyticsView (Phase G - 12 KPIs & Khung Giờ Vàng)',
      path: './src/CommerceLiveAnalyticsView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        apiRequest: async () => ({
          success: true,
          data: {
            kpis: {
              views: 15000,
              peak_viewers: 850,
              avg_watch_time: '2m 15s',
              ctr_live: 70.5,
              enter_room_rate: 3.4,
              sku_order_rate: 4.8,
              follow_rate: 1.2,
              comment_rate: 15.0,
              share_rate: 2.5,
              gpm: 85000,
              gmv_per_hour: 750000,
              ads_roi: 16.2
            },
            golden_hours: {
              top_slots: [
                { day: 'Thứ Tư', time: '20:00 - 22:00', gmv: 45000000, orders: 150 }
              ]
            }
          }
        })
      }
    },
    {
      name: 'CommerceShopeeView (Phase I - Multi-channel Analytics)',
      path: './src/CommerceShopeeView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        apiRequest: async () => ({
          success: true,
          data: {
            summary: {
              order_count: 85,
              gross_sales: 15000000,
              loss_amount: 1500000,
              realized_sales: 13500000,
              loss_rate_pct: 10.0,
              cancelled_amount: 500000,
              failed_amount: 500000,
              return_amount: 500000
            },
            top_golden_slots: [
              { day_name: 'Chủ Nhật', hour_of_day: 20, total_gmv: 5000000, order_count: 28 }
            ]
          }
        })
      }
    },
    {
      name: 'CommerceSyncManagementView (Data Ingestion & Integrity)',
      path: './src/CommerceSyncManagementView.jsx',
      props: {
        shopId: '7495657895504611503',
        apiRequest: async () => ({ success: true, data: { status: 'READY', jobs: [] } })
      }
    },
    {
      name: 'CommerceDashboardView (Unified Tab Router)',
      path: './src/CommerceDashboardView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        subTab: 'overview',
        apiRequest: async () => ({ success: true, data: {} })
      }
    },
    {
      name: 'CommerceDashboardView - Finance Subtab',
      path: './src/CommerceDashboardView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        subTab: 'finance',
        apiRequest: async () => ({ success: true, data: { statements: [] } })
      }
    },
    {
      name: 'CommerceDashboardView - Ads Subtab',
      path: './src/CommerceDashboardView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        subTab: 'ads',
        apiRequest: async () => ({ success: true, data: { campaigns: [] } })
      }
    },
    {
      name: 'CommerceDashboardView - Affiliate Subtab',
      path: './src/CommerceDashboardView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        subTab: 'affiliate',
        apiRequest: async () => ({ success: true, data: {} })
      }
    },
    {
      name: 'CommerceDashboardView - Live Analytics Subtab',
      path: './src/CommerceDashboardView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        subTab: 'live_analytics',
        apiRequest: async () => ({ success: true, data: {} })
      }
    },
    {
      name: 'CommerceDashboardView - Shopee Subtab',
      path: './src/CommerceDashboardView.jsx',
      props: {
        shopId: '7495657895504611503',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        subTab: 'shopee',
        apiRequest: async () => ({ success: true, data: {} })
      }
    },
    {
      name: 'App Root Component (Full Application Tree)',
      path: './src/App.jsx',
      props: {}
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const mod = await vite.ssrLoadModule(tc.path);
      const Component = mod.default || mod[Object.keys(mod)[0]];
      const html = renderToString(React.createElement(Component, tc.props));
      if (html && html.length > 0) {
        console.log(`[PASS] ${tc.name} rendered cleanly (${html.length} chars)`);
        passed++;
      } else {
        console.warn(`[WARN] ${tc.name} rendered empty HTML`);
        passed++;
      }
    } catch (err) {
      console.error(`[FAIL] ${tc.name} THREW ERROR:\n`, err);
      failed++;
    }
  }

  await vite.close();
  console.log(`\n=== RUNTIME RENDER SUMMARY ===`);
  console.log(`Total: ${testCases.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

testRuntimeRender();
