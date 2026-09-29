import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://arzxvzjyiwmkxgoagjcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
);
async function t() {
    const { data } = await supabase.from('restaurants').select('name, glovo_url, wolt_url, bolt_url').in('name', ['IKURA ORADEA', 'SM ORADEA', 'SM BUC TITAN', 'SM CLUJ']);
    console.log(data);
}
t();
