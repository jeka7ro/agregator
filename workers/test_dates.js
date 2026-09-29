let daysBack = 15;
let currentDaysBack = daysBack;
while (currentDaysBack > 0) {
    let chunkDays = Math.min(currentDaysBack, 1);
    
    const toDate = new Date()
    toDate.setDate(toDate.getDate() - (daysBack - currentDaysBack))
    toDate.setHours(23, 59, 59, 999)

    const fromDate = new Date(toDate)
    fromDate.setDate(fromDate.getDate() - chunkDays + 1)
    fromDate.setHours(0, 0, 0, 0)
    
    console.log(fromDate.toISOString(), toDate.toISOString());
    currentDaysBack -= chunkDays;
}
