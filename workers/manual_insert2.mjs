import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://arzxvzjyiwmkxgoagjcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
);

async function run() {
    await supabase.from('restaurants').delete().in('name', ['IKURA ORADEA', 'SM ORADEA', 'SM BUC TITAN', 'SM CLUJ']);
    
    const { data, error } = await supabase.from('restaurants').insert([
        {
            name: "IKURA ORADEA", city: "ORADEA", is_active: true,
            iiko_restaurant_id: "d1cb5d9d-6aeb-4b0c-adf9-5ce8648ce4e1",
            wolt_url: "https://wolt.com/ro/rou/oradea/restaurant/ikura-sushi-oradea-67dd59415e61a1513fbf7045"
        },
        {
            name: "SM ORADEA", city: "ORADEA", is_active: true,
            iiko_restaurant_id: "f4742901-905f-4b4c-86ea-ce85dc09a041",
            wolt_url: "https://wolt.com/ro/rou/oradea/restaurant/sushi-master-oradea-67dd59415e61a1513fbf7038"
        },
        {
            name: "SM BUC TITAN", city: "BUCURESTI", is_active: true,
            iiko_restaurant_id: "04062575-5a47-426b-9d35-9dc748f24139",
            wolt_url: "https://wolt.com/ro/rou/bucharest/restaurant/sushi-master-bucuresti-halelor-67dd59415e61a1513fbf7037"
        },
        {
            name: "SM CLUJ", city: "CLUJ-NAPOCA", is_active: true,
            iiko_restaurant_id: "90296b11-9ba9-4279-a69b-1f84e193315e"
        }
    ]).select();

    if (error) {
        console.error("UPS EROARE", error);
    } else {
        console.log("INSERTION COMPLETE! Rows:", data.length);
    }
}
run();
