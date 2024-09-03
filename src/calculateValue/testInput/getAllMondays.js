const getMondays = () => {
  const mondays = [];
  const year = 2024;

  const date = new Date(year, 0, 1);

  while (date.getFullYear() === year) {
    if (date.getDay() === 1) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      mondays.push(formattedDate);
    }

    date.setDate(date.getDate() + 1);
  }

  return mondays;
};

module.exports = {
  getMondays,
};
